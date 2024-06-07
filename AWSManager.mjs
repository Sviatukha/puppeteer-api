import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';
import { Upload } from '@aws-sdk/lib-storage';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import {
  S3RequestPresigner,
  getSignedUrl,
} from '@aws-sdk/s3-request-presigner';
import { Sha256 } from '@aws-crypto/sha256-browser';
import { generateHex } from './generateHex.mjs';

const REACT_APP_AWS_BUCKET_NAME = 'gipper-college-logos-development';
const REACT_APP_AMAZON_REGION = 'us-east-1';
const REACT_APP_UPLOAD_FILE_ROLE =
  'us-east-1:0a9d014b-6f23-4362-a553-79ee9fb18a1a';

class AWS {
  constructor(region, identityPoolId) {
    this.s3Client = this.initialize(region, identityPoolId);
    this.LambdaClient = this.initLambdaClient(region, identityPoolId);
    this.signer = this.signerInit(region, identityPoolId);
    this.crashCounter = 0;
  }

  initialize(region, identityPoolId) {
    return new S3Client({
      region,
      credentials: fromCognitoIdentityPool({
        identityPoolId,
        clientConfig: { region },
      }),
    });
  }

  initLambdaClient(region, identityPoolId) {
    return new LambdaClient({
      region,
      credentials: fromCognitoIdentityPool({
        identityPoolId,
        clientConfig: { region },
      }),
    });
  }

  signerInit(region, identityPoolId) {
    return new S3RequestPresigner({
      region: region,
      credentials: fromCognitoIdentityPool({
        identityPoolId,
        clientConfig: { region },
        sha256: Sha256,
      }),
    });
  }

  async putObject(body, key, bucket = REACT_APP_AWS_BUCKET_NAME, ACL) {
    try {
      return await this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          // ACL: ACL,
        })
      );
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async uploadFile(
    body,
    key,
    updateProgressPercents,
    bucket = REACT_APP_AWS_BUCKET_NAME
  ) {
    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: bucket,
          Key: key,
          Body: body,
        },
      });

      upload.on('httpUploadProgress', (progress) => {
        const { total, loaded } = progress;
        const percentsLoaded = Math.round((loaded / total) * 100);
        updateProgressPercents && updateProgressPercents(percentsLoaded);
        console.log(`progress: ${percentsLoaded}`);
      });

      if (body.size) {
        console.log('file size: ', (body.size / 1000000).toFixed(1) + 'MB');
      }
      console.log(`progress: 0`);
      updateProgressPercents && updateProgressPercents(0);

      await upload.done();
    } catch (error) {
      updateProgressPercents('error');
      console.log(error);
      throw error;
    }
  }

  async uploadPresetFile(
    body,
    key,
    updateProgressPercents,
    bucket = REACT_APP_AWS_BUCKET_NAME
  ) {
    const upload = new Upload({
      client: this.s3Client,
      params: {
        ContentType: 'json',
        Bucket: bucket,
        Key: key,
        Body: body,
      },
      leavePartsOnError: true,
    });
    try {
      upload.on('httpUploadProgress', (progress) => {
        const { total, loaded } = progress;
        const percentsLoaded = Math.round((loaded / total) * 100);
        updateProgressPercents && updateProgressPercents(percentsLoaded);
        console.log(`progress: ${percentsLoaded}`);
        console.log(loaded);
      });

      if (body.size) {
        console.log('file size: ', (body.size / 1000000).toFixed(1) + 'MB');
      }
      console.log(`progress: 0`);
      updateProgressPercents && updateProgressPercents(0);

      await upload.done();
    } catch (error) {
      console.log(
        'upload in some part crashed, crash counter:',
        this.crashCounter
      );
      this.crashCounter++;
      // if (this.crashCounter > 3) {
      //   upload.abort();
      // }
      updateProgressPercents('error');
      console.log(error);
      throw error;
    }
  }

  async getObjectEncoded(key, bucket) {
    try {
      const { Body } = await this.s3Client.send(
        new GetObjectCommand({
          // in future we need change it to production key ("platform-gipper")
          Bucket: bucket || REACT_APP_AWS_BUCKET_NAME,
          Key: key,
        })
      );
      const chunks = [];
      for await (const chunk of Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const base64Image = buffer.toString('base64');
      return base64Image;
    } catch (error) {
      console.log(`key: ${key},\n bucket: ${bucket}`, error);
      throw error;
    }
  }

  async getListObjectsV2Command(key, bucket) {
    try {
      const { Contents } = await this.s3Client.send(
        new ListObjectsV2Command({
          // in future we need change it to production key ("platform-gipper")
          Bucket: bucket || REACT_APP_AWS_BUCKET_NAME,
          Prefix: key,
        })
      );
      const { Body } = await this.s3Client.send(
        new GetObjectCommand({
          // in future we need change it to production key ("platform-gipper")
          Bucket: bucket || REACT_APP_AWS_BUCKET_NAME,
          Key: Contents[0]?.Key,
        })
      );
      const dataReader = Body.getReader();
      const encodedData = await this.createEncodedData(dataReader);
      const decodedData = Buffer.from(encodedData).toString('base64');
      return `data:image/${
        Contents[0]?.Key.split('.')[1] ?? 'png'
      };base64,${decodedData}`;
    } catch (error) {
      console.log(`key: ${key},\n bucket: ${bucket}`, error);
      throw error;
    }
  }

  async createEncodedData(reader) {
    const chunks = [];
    let isDone = false;

    while (!isDone) {
      const { done, value } = await reader.read();
      if (value) {
        chunks.push(value);
      }
      isDone = done;
    }

    return chunks.reduce((acc, chunk) => {
      const next = new Uint8Array(acc.length + chunk.length);
      next.set(acc);
      next.set(chunk, acc.length);
      return next;
    }, new Uint8Array(0));
  }

  async copyObject(
    sourceKey,
    keyPath = '',
    formatParam,
    bucket = REACT_APP_AWS_BUCKET_NAME
  ) {
    const wholeSource = `/${bucket}/${sourceKey}`;
    const format = formatParam || `.${sourceKey.split('.').at(-1)}`;
    const key = generateHex();
    const wholeKey = `${keyPath}${key}${format}`;
    const resetExtention = (str) => str.split('.')[0];

    let data;
    try {
      data = await this.s3Client.send(
        new CopyObjectCommand({
          CopySource: wholeSource,
          Key: wholeKey,
          Bucket: bucket,
        })
      );
    } catch (error) {
      data = await this.s3Client.send(
        new CopyObjectCommand({
          CopySource: `/${bucket}/${resetExtention(sourceKey)}`,
          Key: wholeKey,
          Bucket: bucket,
        })
      );
    }

    return { data, key };
  }

  async deleteObject(key, bucket = REACT_APP_AWS_BUCKET_NAME) {
    try {
      const data = await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key })
      );
      console.log('Deleted', data, key);
    } catch (error) {
      console.log('Error', error);
    }
  }

  async getImage(src) {
    const [key, bucket] = setImageSrcForAWS(src);
    const imageFormat = key.split('.')[1] ?? 'png';

    const encodedData = await this.getObjectEncoded(key, bucket);
    const decodedData = Buffer.from(encodedData).toString('base64');
    const decodedToBase64 = `data:image/${
      imageFormat === 'svg' ? 'svg+xml' : imageFormat
    };base64,${decodedData}`;

    return decodedToBase64;
  }

  async lambdaInvoke(lanbdaParams) {
    try {
      const comand = new InvokeCommand(lanbdaParams);
      const response = await this.LambdaClient.send(comand);
      console.log('lambda invoked');
    } catch (error) {
      console.log(error, 'error lambda video connvert');
    }
  }

  async getSignUrl(unsignedUrl) {
    try {
      const fileName = unsignedUrl.split('/').slice(4).join('/');
      const command = new GetObjectCommand(_getPictureData(unsignedUrl));
      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600,
      });
      return presignedUrl;
    } catch (error) {
      console.log(error, 'get signed url');
    }
  }

  async getSignedUrlFont(unsignedUrl) {
    const getBucket = (url) => {
      if (url.includes('gipper-college-logos-development')) {
        return 'gipper-college-logos-development';
      }
      if (url.includes('platform-gipper')) {
        return 'platform-gipper';
      }
      return 'gipper-static-assets';
    };

    const getUrlData = (url) => {
      const urlSerments = url.split('/').reverse();
      const key = url.includes('default_newsletters_fonts')
        ? urlSerments[1] + '/' + urlSerments[0]
        : urlSerments[0];

      return {
        Key: key,
        Bucket: getBucket(url),
      };
    };
    try {
      const command = new GetObjectCommand(getUrlData(unsignedUrl));
      const presignedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600,
      });
      return presignedUrl;
    } catch (error) {
      console.log(error, 'get signed font url');
    }
  }
}

export const AWSManager = new AWS(
  REACT_APP_AMAZON_REGION,
  // later we should remove a pool id from here
  REACT_APP_UPLOAD_FILE_ROLE
);

function _getPictureData(imageUrl) {
  const conditions = ['/gipper-college-logos/', '/platform-gipper/'];
  switch (true) {
    case imageUrl.includes('/assets/'):
      let pathToPicture = imageUrl.split('/assets/').reverse()[0];
      let indexSplit = pathToPicture.lastIndexOf('/');
      return {
        Key:
          'stock_images/' +
          (indexSplit <= 0 ? '' : `${pathToPicture.slice(0, indexSplit)}/`) +
          pathToPicture.split('/').reverse()[0],
        Bucket: 'gipper-static-assets',
      };
    case imageUrl.includes('/stock_images/'):
      let pathToStockPicture = imageUrl.split('/stock_images/').reverse()[0];
      return {
        Key: 'stock_images/' + pathToStockPicture.split('/').reverse()[0],
        Bucket: 'gipper-static-assets',
      };
    case imageUrl.includes('/icons/'):
      let pathToIconsPicture = imageUrl.split('/icons/').reverse()[0];
      return {
        Key: 'icons/' + pathToIconsPicture.split('/').reverse()[0],
        Bucket: 'gipper-static-assets',
      };
    case imageUrl.includes('/holiday_icons/'):
      let pathToholiday_iconsPicture = imageUrl
        .split('/holiday_icons/')
        .reverse()[0];
      return {
        Key:
          'holiday_icons/' + pathToholiday_iconsPicture.split('/').reverse()[0],
        Bucket: 'gipper-static-assets',
      };
    case imageUrl.includes('/templates_background_images/'):
      return {
        Key: 'templates_background_images/' + imageUrl.split('/').reverse()[0],
        Bucket: 'gipper-static-assets',
      };
    case imageUrl.includes('/templates_default_logos/'):
      return {
        Key: 'templates_default_logos/' + imageUrl.split('/').reverse()[0],
        Bucket: 'gipper-static-assets',
      };
    case imageUrl.includes('gipper-static-assets'):
      let pathToPictureq = imageUrl.split('gipper-static-assets/').reverse()[0];
      let indexSplitq = pathToPictureq.lastIndexOf('/');
      return {
        Key:
          (indexSplitq <= 0 ? '' : `${pathToPictureq.slice(0, indexSplitq)}/`) +
          pathToPictureq.split('/').reverse()[0],
        Bucket: 'gipper-static-assets',
      };
    case imageUrl.includes('/gipper-college-logos-development/'):
      let pictureName = imageUrl
        .split('/gipper-college-logos-development/')
        .reverse()[0];

      return {
        Key: pictureName,
        Bucket: 'gipper-college-logos-development',
      };
    case conditions.some((el) => imageUrl.includes(el)):
      return {
        Key: imageUrl
          .split(/\/gipper-college-logos\/|\/platform-gipper\//)
          .reverse()[0],
        Bucket: 'platform-gipper',
      };
    default:
      return {
        Key: pictureName,
        Bucket: REACT_APP_AWS_BUCKET_NAME,
      };
  }
}

export const setImageSrcForAWS = (imageUrl) => {
  const prodConditions = [
    '/gipper-college-logos/',
    '/gipper-college-logos.s3.amazonaws.com/',
    '/platform-gipper/',
    '/platform-gipper.s3.amazonaws.com/',
    'd1txs74qdv0iht',
  ];

  const devConditions = ['d2tyu887lcxnka.cloudfront.net'];

  switch (true) {
    case imageUrl.includes('/assets/'):
      const pathToPicture = imageUrl.split('/assets/').reverse()[0];
      const indexSplit = pathToPicture.lastIndexOf('/');
      const name = pathToPicture.split('/').reverse()[0];

      return [
        `stock_images${
          (indexSplit <= 0 ? '' : `/${pathToPicture.slice(0, indexSplit)}`) +
          `/${name}`
        }`,
        'gipper-static-assets',
      ];

    case imageUrl.includes('/stock_images/'):
      let pathToStockPicture = imageUrl.split('/stock_images/').reverse()[0];
      return [
        `stock_images/${pathToStockPicture.split('/').reverse()[0]}`,
        'gipper-static-assets',
      ];

    case imageUrl.includes('/icons/'):
      let pathToIconsPicture = imageUrl.split('/icons/').reverse()[0];
      return [
        `icons/${pathToIconsPicture.split('/').reverse()[0]}`,
        'gipper-static-assets',
      ];

    case imageUrl.includes('/holiday_icons/'):
      let pathToholiday_iconsPicture = imageUrl
        .split('/holiday_icons/')
        .reverse()[0];
      return [
        `holiday_icons/${pathToholiday_iconsPicture.split('/').reverse()[0]}`,
        'gipper-static-assets',
      ];

    case imageUrl.includes('/templates_background_images/'):
      return [
        `templates_background_images/${imageUrl.split('/').reverse()[0]}`,
        'gipper-static-assets',
      ];

    case imageUrl.includes('/templates_default_logos/'):
      return [
        `templates_default_logos/${imageUrl.split('/').reverse()[0]}`,
        'gipper-static-assets',
      ];

    case imageUrl.includes('/gipper-static-assets/'):
      const pathToPictureq = imageUrl
        .split('gipper-static-assets/')
        .reverse()[0];
      const indexSplitq = pathToPictureq.lastIndexOf('/');
      const nameq = pathToPictureq.split('/').reverse()[0];
      return [
        (indexSplitq <= 0 ? '' : `${pathToPictureq.slice(0, indexSplitq)}/`) +
          nameq,
        'gipper-static-assets',
      ];

    case imageUrl.includes('dzfa1uifb0sb6'):
      return [imageUrl.split('/').reverse()[0], 'gipper-static-assets'];

    case imageUrl.includes('/gipper-college-logos-development/'):
      let pictureName = imageUrl
        .split('/gipper-college-logos-development/')
        .reverse()[0];
      return [pictureName, 'gipper-college-logos-development'];

    case prodConditions.some((el) => imageUrl.includes(el)):
      return [imageUrl.split('/').reverse()[0], 'platform-gipper'];
    case devConditions.some((el) => imageUrl.includes(el)):
      return [
        imageUrl.split('/').reverse()[0],
        'gipper-college-logos-development',
      ];
    default:
      console.log(`setImageSrcForAWS: Didn't find a case for ${imageUrl}`);
  }
};
