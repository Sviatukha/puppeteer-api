export const secureURL = (incomingURL) => {
  switch (true) {
    case incomingURL?.includes('s3.amazonaws.com/platform-gipper'):
      return incomingURL.replace(
        's3.amazonaws.com/platform-gipper',
        'd1txs74qdv0iht.cloudfront.net'
      );
    case incomingURL?.includes('platform-gipper.s3.amazonaws.com'):
      return incomingURL.replace(
        'platform-gipper.s3.amazonaws.com',
        'd1txs74qdv0iht.cloudfront.net'
      );
    case incomingURL?.includes('gipper-transcoded-videos-dev.s3.amazonaws.com'):
      return incomingURL.replace(
        'gipper-transcoded-videos-dev.s3.amazonaws.com',
        'd11cc8kkk70spw.cloudfront.net'
      );
    case incomingURL?.includes('s3.amazonaws.com/gipper-transcoded-videos-dev'):
      return incomingURL.replace(
        's3.amazonaws.com/gipper-transcoded-videos-dev',
        'd11cc8kkk70spw.cloudfront.net'
      );
    case incomingURL?.includes('gipper-static-assets.s3.amazonaws.com'):
      return incomingURL.replace(
        'gipper-static-assets.s3.amazonaws.com',
        'dzfa1uifb0sb6.cloudfront.net'
      );
    case incomingURL?.includes('s3.amazonaws.com/gipper-static-assets'):
      return incomingURL.replace(
        's3.amazonaws.com/gipper-static-assets',
        'dzfa1uifb0sb6.cloudfront.net'
      );
    case incomingURL?.includes('gipper-college-pucture-test'):
      return incomingURL.replace(
        'gipper-college-pucture-test.s3.amazonaws.com',
        'd3vvl64dagn33v.cloudfront.net'
      );
    case incomingURL?.includes(
      's3.amazonaws.com/gipper-college-logos-development'
    ):
      return incomingURL.replace(
        's3.amazonaws.com/gipper-college-logos-development',
        'd2tyu887lcxnka.cloudfront.net'
      );
    case incomingURL?.includes(
      'gipper-college-logos-development.s3.amazonaws.com'
    ):
      return incomingURL.replace(
        'gipper-college-logos-development.s3.amazonaws.com',
        'd2tyu887lcxnka.cloudfront.net'
      );
    default:
      return incomingURL;
  }
};
