// Mock/wrapper for native_bridge protobuf module
// This provides a CommonJS-compatible interface for Jest testing

const $protobuf = require('protobufjs/minimal');

// Re-export the actual generated code by requiring it dynamically
// This works because we're in a CommonJS context
let native_bridge_module;

try {
  // Try to load the ES6 module version if available
  native_bridge_module = require('../../src_generated/native_bridge.js');
  if (native_bridge_module && native_bridge_module.native_bridge) {
    exports.native_bridge = native_bridge_module.native_bridge;
  }
} catch (e) {
  // If that fails, create a minimal mock structure for testing
  console.warn('[native_bridge mock] Could not load actual module, using minimal mock');

  const native_bridge = {};

  // CliResponse message
  native_bridge.CliResponse = class CliResponse {
    constructor(properties) {
      if (properties) {
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i) {
          if (properties[keys[i]] != null) {
            this[keys[i]] = properties[keys[i]];
          }
        }
      }
    }

    static create(properties) {
      return new CliResponse(properties);
    }

    static fromObject(object) {
      if (object instanceof native_bridge.CliResponse) return object;
      let message = new native_bridge.CliResponse();
      if (object.success != null) message.success = Boolean(object.success);
      if (object.command != null) message.command = String(object.command);
      if (object.timestamp != null) message.timestamp = object.timestamp;
      if (object.simpleResult != null) message.simpleResult = String(object.simpleResult);
      if (object.errorMessage != null) message.errorMessage = String(object.errorMessage);
      if (object.errorStackTrace != null) message.errorStackTrace = String(object.errorStackTrace);
      if (object.exportResult != null) {
        if (typeof object.exportResult !== 'object')
          throw TypeError('.native_bridge.CliResponse.exportResult: object expected');
        message.exportResult = native_bridge.ExportResult.fromObject(object.exportResult);
      }
      return message;
    }

    static encode(message, writer) {
      if (!writer) writer = $protobuf.Writer.create();
      if (message.success != null && Object.hasOwnProperty.call(message, 'success'))
        writer.uint32(8).bool(message.success);
      if (message.command != null && Object.hasOwnProperty.call(message, 'command'))
        writer.uint32(18).string(message.command);
      if (message.timestamp != null && Object.hasOwnProperty.call(message, 'timestamp'))
        writer.uint32(24).int64(message.timestamp);
      if (message.simpleResult != null && Object.hasOwnProperty.call(message, 'simpleResult'))
        writer.uint32(34).string(message.simpleResult);
      if (message.errorMessage != null && Object.hasOwnProperty.call(message, 'errorMessage'))
        writer.uint32(42).string(message.errorMessage);
      if (message.errorStackTrace != null && Object.hasOwnProperty.call(message, 'errorStackTrace'))
        writer.uint32(50).string(message.errorStackTrace);
      if (message.exportResult != null && Object.hasOwnProperty.call(message, 'exportResult'))
        native_bridge.ExportResult.encode(message.exportResult, writer.uint32(58).fork()).ldelim();
      return writer;
    }

    static decode(reader, length) {
      if (!(reader instanceof $protobuf.Reader)) reader = $protobuf.Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length;
      let message = new native_bridge.CliResponse();
      while (reader.pos < end) {
        let tag = reader.uint32();
        switch (tag >>> 3) {
          case 1:
            message.success = reader.bool();
            break;
          case 2:
            message.command = reader.string();
            break;
          case 3:
            message.timestamp = reader.int64();
            break;
          case 4:
            message.simpleResult = reader.string();
            break;
          case 5:
            message.errorMessage = reader.string();
            break;
          case 6:
            message.errorStackTrace = reader.string();
            break;
          case 7:
            message.exportResult = native_bridge.ExportResult.decode(reader, reader.uint32());
            break;
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    }
  };

  // ExportResult message
  native_bridge.ExportResult = class ExportResult {
    constructor(properties) {
      if (properties) {
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i) {
          if (properties[keys[i]] != null) {
            this[keys[i]] = properties[keys[i]];
          }
        }
      }
    }

    static create(properties) {
      return new ExportResult(properties);
    }

    static fromObject(object) {
      if (object instanceof native_bridge.ExportResult) return object;
      let message = new native_bridge.ExportResult();
      if (object.echo != null) message.echo = String(object.echo);
      if (object.vcards != null) {
        if (typeof object.vcards !== 'object')
          throw TypeError('.native_bridge.ExportResult.vcards: object expected');
        message.vcards = native_bridge.VCardData.fromObject(object.vcards);
      }
      if (object.mergedVcards != null) message.mergedVcards = String(object.mergedVcards);
      return message;
    }

    static encode(message, writer) {
      if (!writer) writer = $protobuf.Writer.create();
      if (message.echo != null && Object.hasOwnProperty.call(message, 'echo'))
        writer.uint32(10).string(message.echo);
      if (message.vcards != null && Object.hasOwnProperty.call(message, 'vcards'))
        native_bridge.VCardData.encode(message.vcards, writer.uint32(18).fork()).ldelim();
      if (message.mergedVcards != null && Object.hasOwnProperty.call(message, 'mergedVcards'))
        writer.uint32(26).string(message.mergedVcards);
      return writer;
    }

    static decode(reader, length) {
      if (!(reader instanceof $protobuf.Reader)) reader = $protobuf.Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length;
      let message = new native_bridge.ExportResult();
      while (reader.pos < end) {
        let tag = reader.uint32();
        switch (tag >>> 3) {
          case 1:
            message.echo = reader.string();
            break;
          case 2:
            message.vcards = native_bridge.VCardData.decode(reader, reader.uint32());
            break;
          case 3:
            message.mergedVcards = reader.string();
            break;
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    }
  };

  // VCardData message
  native_bridge.VCardData = class VCardData {
    constructor(properties) {
      this.vcards = [];
      if (properties) {
        for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i) {
          if (properties[keys[i]] != null) {
            this[keys[i]] = properties[keys[i]];
          }
        }
      }
    }

    static create(properties) {
      return new VCardData(properties);
    }

    static fromObject(object) {
      if (object instanceof native_bridge.VCardData) return object;
      let message = new native_bridge.VCardData();
      if (object.vcards) {
        if (!Array.isArray(object.vcards))
          throw TypeError('.native_bridge.VCardData.vcards: array expected');
        message.vcards = [];
        for (let i = 0; i < object.vcards.length; ++i) {
          message.vcards[i] = String(object.vcards[i]);
        }
      }
      return message;
    }

    static encode(message, writer) {
      if (!writer) writer = $protobuf.Writer.create();
      if (message.vcards != null && message.vcards.length) {
        for (let i = 0; i < message.vcards.length; ++i) {
          writer.uint32(10).string(message.vcards[i]);
        }
      }
      return writer;
    }

    static decode(reader, length) {
      if (!(reader instanceof $protobuf.Reader)) reader = $protobuf.Reader.create(reader);
      let end = length === undefined ? reader.len : reader.pos + length;
      let message = new native_bridge.VCardData();
      while (reader.pos < end) {
        let tag = reader.uint32();
        switch (tag >>> 3) {
          case 1:
            if (!(message.vcards && message.vcards.length)) message.vcards = [];
            message.vcards.push(reader.string());
            break;
          default:
            reader.skipType(tag & 7);
            break;
        }
      }
      return message;
    }
  };

  exports.native_bridge = native_bridge;
}
