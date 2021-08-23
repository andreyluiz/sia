const builtinConstructors = require("./constructors");
const SIA_TYPES = require("./types");
const utfz = require("./utfz");
const int = require("./int");

const { toString } = Object.prototype;
const typeOf = (item) => toString.call(item);

class Sia {
  constructor({
    onBlocksReady,
    nBlocks = 1,
    size = 33554432,
    constructors = builtinConstructors,
  } = {}) {
    this.map = new Map();
    this.buffer = Buffer.alloc(size);
    this.offset = 0;
    this.blocks = 0;
    this.dataBlocks = 0;
    this.onBlocksReady = onBlocksReady;
    this.nBlocks = nBlocks;
    this.bufferedBlocks = 0;
    this.constructors = constructors;
    this.strings = 0;
  }
  reset() {
    this.offset = 0;
    this.strings = 0;
    this.map = new Map();
  }
  writeString(str, offset) {
    return this.buffer.write(str, offset);
  }
  writeUIntN(bytes, number) {
    this.buffer.writeUIntLE(number, this.offset, bytes);
    this.offset += bytes;
  }
  writeIntN(bytes, number) {
    this.buffer.writeIntLE(number, this.offset, bytes);
    this.offset += bytes;
  }
  writeUInt8(number) {
    this.buffer.writeUInt8(number, this.offset);
    this.offset += 1;
  }
  writeUInt16(number) {
    this.buffer.writeUInt16LE(number, this.offset);
    this.offset += 2;
  }
  writeUInt32(number) {
    this.buffer.writeUInt32LE(number, this.offset);
    this.offset += 4;
  }
  writeInt16(number) {
    this.buffer.writeInt16LE(number, this.offset);
    this.offset += 2;
  }
  writeInt32(number) {
    this.buffer.writeInt32LE(number, this.offset);
    this.offset += 4;
  }
  writeDouble(number) {
    this.buffer.writeDoubleLE(number, this.offset);
    this.offset += 8;
  }
  addString(string) {
    const { length } = string;
    const maxBytes = length * 3;
    // See benchmarks/string/both
    if (length < 24) {
      this.writeUInt8(SIA_TYPES.utfz);
      const byteLength = utfz.pack(
        string,
        length,
        this.buffer,
        this.offset + 1
      );
      this.buffer.writeUInt8(byteLength, this.offset);
      this.offset += byteLength + 1;
    } else if (maxBytes < 0x100) {
      //if (length < 128) {
      this.writeUInt8(SIA_TYPES.string8);
      const byteLength = this.writeString(string, this.offset + 1);
      this.buffer.writeUInt8(byteLength, this.offset);
      this.offset += byteLength + 1;
      //} else {
      //  this.writeUInt8(SIA_TYPES.string8);
      //  const byteLength = this.writeString(string, this.offset + 1);
      //  this.buffer.writeUInt8(byteLength, this.offset);
      //  this.offset += byteLength + 1;
      //}
    } else if (maxBytes < 0x10000) {
      this.writeUInt8(SIA_TYPES.string16);
      const byteLength = this.writeString(string, this.offset + 2);
      this.buffer.writeUInt16LE(byteLength, this.offset);
      this.offset += byteLength + 2;
    } else {
      this.writeUInt8(SIA_TYPES.string32);
      const byteLength = this.writeString(string, this.offset + 4);
      this.buffer.writeUInt32LE(byteLength, this.offset);
      this.offset += byteLength + 4;
    }
  }
  addRef(ref) {
    if (ref < 0x100) {
      this.writeUInt8(SIA_TYPES.ref8);
      this.writeUInt8(ref);
    } else if (ref < 0x10000) {
      this.writeUInt8(SIA_TYPES.ref16);
      this.writeUInt16(ref);
    } else if (ref < 0x100000000) {
      this.writeUInt8(SIA_TYPES.ref32);
      this.writeUInt32(ref);
    } else {
      throw `Ref size ${ref} is too big`;
    }
  }
  addNumber(number) {
    // TODO: make this faster https://jsben.ch/26igA
    if (Number.isInteger(number)) return this.addInteger(number);
    return this.addFloat(number);
  }
  addInteger(number) {
    if (number < 0) {
      const byes = int.byteSizeOfNegative(number);
      const type = int.negativeNumberTypes[byes];
      this.writeUInt8(type);
      this.writeIntN(byes, number);
    } else {
      const byes = int.byteSizeOfPositive(number);
      const type = int.positiveNumberTypes[byes];
      this.writeUInt8(type);
      this.writeUIntN(byes, number);
    }
  }
  addFloat(number) {
    this.writeUInt8(SIA_TYPES.float64);
    this.writeDouble(number);
  }
  startArray(length) {
    if (length < 0x100) {
      this.writeUInt8(SIA_TYPES.arrayStart8);
      this.writeUInt8(length);
    } else if (length < 0x10000) {
      this.writeUInt8(SIA_TYPES.arrayStart16);
      this.writeUInt16(length);
    }
  }
  startObject(length) {
    //if (length < 0x100) {
    this.writeUInt8(SIA_TYPES.objectStart8);
    //  this.writeUInt8(length);
    //} else if (length < 0x10000) {
    //  this.writeUInt8(SIA_TYPES.objectStart16);
    //  this.writeUInt16(length);
    //}
  }
  endObject() {
    this.writeUInt8(SIA_TYPES.objectEnd);
  }
  addBoolean(bool) {
    const type = bool ? SIA_TYPES.true : SIA_TYPES.false;
    this.writeUInt8(type);
  }
  addNull() {
    this.writeUInt8(SIA_TYPES.null);
  }
  addUndefined() {
    this.writeUInt8(SIA_TYPES.undefined);
  }
  addCustomType(item) {
    const { args, constructor } = this.itemToSia(item);
    const argsRef = this.serializeItem(args);
    const typeRef = this.addString(constructor);
    let argsRefSize = 0;
    let typeRefSize = 0;
    if (typeRef < 0x100) {
      typeRefSize = 1;
    } else if (typeRef < 0x10000) {
      typeRefSize = 2;
    } else if (typeRef < 0x100000000) {
      typeRefSize = 3;
    }
    if (argsRef < 0x100) {
      argsRefSize = 1;
    } else if (argsRef < 0x10000) {
      argsRefSize = 2;
    } else if (argsRef < 0x100000000) {
      argsRefSize = 3;
    }
    this.writeUInt8(SIA_TYPES.constructor);
    this.writeUInt8(typeRefSize + argsRefSize * 0x10);
    this.writeUIntN(typeRefSize, typeRef);
    this.writeUIntN(argsRefSize, argsRef);
  }
  serializeItem(item) {
    const type = typeof item;
    switch (type) {
      case "string":
        return this.addString(item);

      case "undefined":
        return this.addUndefined(item);

      case "number":
        return this.addNumber(item);

      case "boolean":
        return this.addBoolean(item);

      case "object": {
        if (item === null) {
          return this.addNull(item);
        } else if (item.constructor === Object) {
          //const keys = Object.keys(item);
          this.startObject();
          for (const key in item) {
            const ref = this.map.get(key);
            if (!ref) {
              this.map.set(key, this.strings++);
              this.addString(key);
            } else {
              this.addRef(ref);
            }
            this.serializeItem(item[key]);
          }
          return this.endObject();
        } else if (Array.isArray(item)) {
          this.startArray(item.length);
          for (const m of item) this.serializeItem(m);
          //return this.endArray();
          return;
        } else {
          return this.addCustomType(item);
        }
      }

      default:
        break;
    }
    return this.addCustomType(item);
  }
  itemToSia(item) {
    const { constructor } = item;
    for (const entry of this.constructors) {
      if (entry.constructor === constructor) {
        return {
          constructor: entry.name,
          args: entry.args(item),
        };
      }
    }
  }
  serialize(data) {
    this.data = data;
    this.reset();
    this.serializeItem(this.data);
    return this.buffer.slice(0, this.offset);
  }
}

class DeSia {
  constructor({
    constructors = builtinConstructors,
    onEnd,
    mapSize = 256 * 1000,
  } = {}) {
    this.constructors = constructors;
    this.map = new Array(mapSize);
    this.blocks = 0;
    this.offset = 0;
    this.onEnd = onEnd;
    this.refMap = new Array(mapSize);
    this.strings = 0;
  }
  reset() {
    this.blocks = 0;
    this.offset = 0;
    this.strings = 0;
  }
  readKey(blockType) {
    switch (blockType) {
      case SIA_TYPES.ref8: {
        const ref = this.readUInt8();
        return this.refMap[ref];
      }

      case SIA_TYPES.ref16: {
        const ref = this.readUInt16();
        return this.refMap[ref];
      }

      case SIA_TYPES.ref32: {
        const ref = this.readUInt32();
        return this.refMap[ref];
      }

      case SIA_TYPES.utfz: {
        const length = this.readUInt8();
        const str = utfz.unpack(this.buffer, length, this.offset);
        this.offset += length;
        this.refMap[this.strings++] = str;
        return str;
      }

      case SIA_TYPES.string8: {
        const length = this.readUInt8();
        const str = this.readString(length);
        this.refMap[this.strings++] = str;
        return str;
      }

      case SIA_TYPES.string16: {
        const length = this.readUInt16();
        const str = this.readString(length);
        this.refMap[this.strings++] = str;
        return str;
      }

      case SIA_TYPES.string32: {
        const length = this.readUInt32();
        const str = this.readString(length);
        this.refMap[this.strings++] = str;
        return str;
      }

      default:
        throw `Key of type ${blockType} is invalid.`;
    }
  }
  readBlock() {
    const blockType = this.readUInt8();
    switch (blockType) {
      case SIA_TYPES.utfz: {
        const length = this.readUInt8();
        const str = utfz.unpack(this.buffer, length, this.offset);
        this.offset += length;
        //this.refMap[this.strings++] = str;
        return str;
      }

      case SIA_TYPES.string8: {
        const length = this.readUInt8();
        const str = this.readString(length);
        //this.refMap[this.strings++] = str;
        return str;
      }

      case SIA_TYPES.string16: {
        const length = this.readUInt16();
        const str = this.readString(length);
        //this.refMap[this.strings++] = str;
        return str;
      }

      case SIA_TYPES.string32: {
        const length = this.readUInt32();
        const str = this.readString(length);
        //this.refMap[this.strings++] = str;
        return str;
      }

      case SIA_TYPES.uint8: {
        return this.readUInt8();
      }

      case SIA_TYPES.uint16: {
        return this.readUInt16();
      }

      case SIA_TYPES.uint24: {
        return this.readUIntN(3);
      }

      case SIA_TYPES.uint32: {
        return this.readInt32();
      }

      case SIA_TYPES.float64: {
        return this.readDouble();
      }

      case SIA_TYPES.constructor: {
        const size = this.readUInt8();
        const typeSize = size & 0xf;
        const argsSize = size >> 4;
        const typeRef = this.readUIntN(typeSize);
        const argsRef = this.readUIntN(argsSize);
        const name = this.map[typeRef];
        const args = this.map[argsRef];
        for (const entry of this.constructors) {
          if (entry.name === name) {
            const value = entry.build(...args);
            return value;
          }
        }
      }

      case SIA_TYPES.false:
        return false;

      case SIA_TYPES.true:
        return true;

      case SIA_TYPES.null:
        return null;

      case SIA_TYPES.undefined:
        return undefined;

      case SIA_TYPES.objectStart8: {
        const obj = {};
        //let length = this.readUInt8();
        let curr = this.buffer[this.offset++];
        const { objectEnd } = SIA_TYPES;
        while (curr !== objectEnd) {
          obj[this.readKey(curr)] = this.readBlock();
          curr = this.buffer[this.offset++];
        }
        return obj;
        //break;
      }

      case SIA_TYPES.arrayStart8: {
        const length = this.readUInt8();
        const arr = new Array(length);
        for (let i = 0; i < length; i++) {
          arr[i] = this.readBlock();
        }
        return arr;
      }

      case SIA_TYPES.arrayStart16: {
        const length = this.readUInt16();
        const arr = new Array(length);
        for (let i = 0; i < length; i++) {
          arr[i] = this.readBlock();
        }
        return arr;
      }

      default:
        const error = `Unsupported type: ${blockType}`;
        throw error;
    }
  }
  readUIntN(n) {
    const intN = this.buffer.readUIntLE(this.offset, n);
    this.offset += n;
    return intN;
  }
  readUInt8() {
    const uInt8 = this.buffer.readUInt8(this.offset);
    this.offset++;
    return uInt8;
  }
  readUInt16() {
    const uInt16 = this.buffer.readUInt16LE(this.offset);
    this.offset += 2;
    return uInt16;
  }
  readUInt32() {
    const uInt32 = this.buffer.readUInt32LE(this.offset);
    this.offset += 4;
    return uInt32;
  }
  readInt32() {
    const int32 = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return int32;
  }
  readDouble() {
    const uInt64 = this.buffer.readDoubleLE(this.offset);
    this.offset += 8;
    return uInt64;
  }
  readString(length) {
    const str = this.buffer.toString("utf8", this.offset, this.offset + length);
    this.offset += length;
    return str;
  }
  deserialize(buffer) {
    this.buffer = buffer;
    this.reset();
    return this.readBlock();
  }
}

const _Sia = new Sia();
const _Desia = new DeSia();

const sia = (data) => _Sia.serialize(data);
const desia = (data) => _Desia.deserialize(data);

module.exports.sia = sia;
module.exports.desia = desia;

module.exports.Sia = Sia;
module.exports.DeSia = DeSia;
module.exports.constructors = builtinConstructors;

/* (async () => {
  const { diff } = require("deep-diff");
  const fetch = require("node-fetch");
  const prettyBytes = require("pretty-bytes");
  const datasets = [
    await fetch("https://jsonplaceholder.typicode.com/photos").then((resp) =>
      resp.json()
    ),
    await fetch(
      "https://github.com/json-iterator/test-data/raw/master/large-file.json"
    ).then((resp) => resp.json()),
  ];
  for (data of datasets) {
    const serialized = sia(data);
    console.log(`Size: ${prettyBytes(serialized.length)}`);
    const deserialized = desia(serialized);
    console.log(diff(data, deserialized));
  }
})();
 */
