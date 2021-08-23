const typeNames = [
  "null",
  "undefined",
  "uint8",
  "uint16",
  "uint24",
  "uint32",
  "uint40",
  "uint48",
  "uint64",
  "uint128",
  "uintn",
  "int8",
  "int16",
  "int24",
  "int32",
  "int40",
  "int48",
  "int64",
  "int128",
  "intn",
  "float8",
  "float16",
  "float24",
  "float32",
  "float40",
  "float48",
  "float64",
  "float128",
  "floatn",
  "ref8",
  "ref16",
  "ref24",
  "ref32",
  "ref40",
  "ref48",
  "ref64",
  "ref128",
  "refn",
  "utfz",
  "string8",
  "string16",
  "string24",
  "string32",
  "string40",
  "string48",
  "string64",
  "string128",
  "stringn",
  "binary",
  "true",
  "false",
  "date",
  "date64",
  "constructor",
  "arrayStart8",
  "arrayStart16",
  "arrayStart24",
  "arrayStart32",
  "arrayEnd",
  "objectStart8",
  "objectStart16",
  "objectStart24",
  "objectStart32",
  "objectEnd",
  "hintSize",
  "end",
];

const types = Object.fromEntries(typeNames.map((name, index) => [name, index]));

module.exports = types;
