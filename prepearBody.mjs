import { AWSManager, setImageSrcForAWS } from './AWSManager.mjs';

const updateURL = async (object) => {
  if (object.type === 'image') {
    const getImage = async (key, bucket) => {
      const encodedData = await AWSManager.getObjectEncoded(key, bucket);
      let decodedToBase64 = `data:image/${
        imageFormat === 'svg' ? 'svg+xml' : imageFormat
      };base64,${encodedData}`;
      object.id === 'logo_2' && console.log(decodedToBase64);
      object.src = decodedToBase64;
    };

    const [key, bucket] = setImageSrcForAWS(object.src);
    const imageFormat = key.split('.').reverse()[0] ?? 'png';
    await getImage(key, bucket);
  }
};

export const prepearBody = async (body) => {
  for (const object of body) {
    await updateURL(object);

    if (object.type === 'group' && object.className !== 'svgElement') {
      if (object.clipPath) {
        delete object.clipPath.startAngle;
        delete object.clipPath.endAngle;
      }
      await prepearBody(object.objects);
    }
  }
};
