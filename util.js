const toHexadecimalNumber = (number) => {
    return `0x${number.toString(16)}`
}

const toExpression = (number) => {
  const hexadecimal = number.toString(16);
  let expression = `0x${hexadecimal[0]}`;

  for (let i = 1; i < hexadecimal.length; i++) {
    const digit = hexadecimal[i];
    const operand = `0x${digit}`;
    const multiplication = `(${expression} * 0x2)`;
    const addition = ` + ${operand}`;
    const subtraction = ` - 0x${hexadecimal[i - 1]}`;

    expression = `(${multiplication}${addition}${subtraction})`;
  }

  expression = `${expression} * 0x2`;

  return expression;
};

module.exports = {toHexadecimalNumber, toExpression}