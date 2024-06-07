export const generateHex = (n = 32) => {
  return [...Array(n)]
    .map(() =>
      Math.floor(Math.random() * 16)
        .toString(16)
        .toUpperCase()
    )
    .join('');
};
