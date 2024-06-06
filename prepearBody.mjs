import { secureURL } from './secureUrl.mjs';

const updateURL = (object) => {
  if (object.type === 'image') {
    object.src = secureURL(object.src);
  }
};

export const prepearBody = (body) => {
  body.forEach((object) => {
    updateURL(object);

    if (object.type === 'group' && object.className !== 'svgElement') {
      if (object.clipPath) {
        delete object.clipPath.startAngle;
        delete object.clipPath.endAngle;
      }
      prepearBody(object.objects);
    }
  });
};
