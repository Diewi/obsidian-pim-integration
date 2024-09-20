using Google.Protobuf;
using NativeBridge;

namespace OutlookComBridge.Tests
{
  /// <summary>
  /// Tests for protobuf serialization and deserialization.
  /// </summary>
  public class ProtobufSerializationTests
  {
    [Fact]
    public void CliResponse_CanSerializeAndDeserialize()
    {
      // Arrange
      var original = new CliResponse
      {
        Success = true,
        Command = "test-command",
        Timestamp = DateTimeOffset.UtcNow.Ticks,
        SimpleResult = "test result"
      };

      // Act
      var bytes = original.ToByteArray();
      var deserialized = CliResponse.Parser.ParseFrom(bytes);

      // Assert
      Assert.Equal(original.Success, deserialized.Success);
      Assert.Equal(original.Command, deserialized.Command);
      Assert.Equal(original.Timestamp, deserialized.Timestamp);
      Assert.Equal(original.SimpleResult, deserialized.SimpleResult);
    }

    [Fact]
    public void CliResponse_WithError_CanSerializeAndDeserialize()
    {
      // Arrange
      var original = new CliResponse
      {
        Success = false,
        Command = "failing-command",
        Timestamp = DateTimeOffset.UtcNow.Ticks,
        ErrorMessage = "Something went wrong",
        ErrorStackTrace = "Stack trace here"
      };

      // Act
      var bytes = original.ToByteArray();
      var deserialized = CliResponse.Parser.ParseFrom(bytes);

      // Assert
      Assert.Equal(original.Success, deserialized.Success);
      Assert.Equal(original.Command, deserialized.Command);
      Assert.Equal(original.ErrorMessage, deserialized.ErrorMessage);
      Assert.Equal(original.ErrorStackTrace, deserialized.ErrorStackTrace);
    }

    [Fact]
    public void ExportResult_WithVCards_CanSerializeAndDeserialize()
    {
      // Arrange
      var vcards = new List<string>
            {
                "BEGIN:VCARD\nFN:John Doe\nEND:VCARD",
                "BEGIN:VCARD\nFN:Jane Smith\nEND:VCARD"
            };
      var original = new ExportResult
      {
        Vcards = new VCardData { Vcards = { vcards } }
      };

      // Act
      var bytes = original.ToByteArray();
      var deserialized = ExportResult.Parser.ParseFrom(bytes);

      // Assert
      Assert.NotNull(deserialized.Vcards);
      Assert.Equal(2, deserialized.Vcards.Vcards.Count);
      Assert.Equal(vcards[0], deserialized.Vcards.Vcards[0]);
      Assert.Equal(vcards[1], deserialized.Vcards.Vcards[1]);
    }

    [Fact]
    public void CliResponse_WithExportResult_CanSerializeAndDeserialize()
    {
      // Arrange
      var vcards = new List<string> { "BEGIN:VCARD\nEND:VCARD" };
      var original = new CliResponse
      {
        Success = true,
        Command = "export-contacts",
        Timestamp = DateTimeOffset.UtcNow.Ticks,
        ExportResult = new ExportResult
        {
          Vcards = new VCardData { Vcards = { vcards } }
        }
      };

      // Act
      var bytes = original.ToByteArray();
      var deserialized = CliResponse.Parser.ParseFrom(bytes);

      // Assert
      Assert.True(deserialized.Success);
      Assert.NotNull(deserialized.ExportResult);
      Assert.NotNull(deserialized.ExportResult.Vcards);
      Assert.Single(deserialized.ExportResult.Vcards.Vcards);
    }

    [Fact]
    public void LengthPrefixedSerialization_WorksCorrectly()
    {
      // Arrange
      var response = new CliResponse
      {
        Success = true,
        Command = "ping",
        Timestamp = DateTimeOffset.UtcNow.Ticks,
        SimpleResult = "pong"
      };

      // Act - Simulate length-prefixed protocol
      var payload = response.ToByteArray();
      var lengthPrefix = BitConverter.GetBytes((uint)payload.Length);
      var fullMessage = new byte[4 + payload.Length];
      Buffer.BlockCopy(lengthPrefix, 0, fullMessage, 0, 4);
      Buffer.BlockCopy(payload, 0, fullMessage, 4, payload.Length);

      // Parse it back
      var readLength = BitConverter.ToUInt32(fullMessage, 0);
      var readPayload = new byte[readLength];
      Buffer.BlockCopy(fullMessage, 4, readPayload, 0, (int)readLength);
      var deserialized = CliResponse.Parser.ParseFrom(readPayload);

      // Assert
      Assert.Equal(payload.Length, (int)readLength);
      Assert.Equal(response.Success, deserialized.Success);
      Assert.Equal(response.SimpleResult, deserialized.SimpleResult);
    }

    [Fact]
    public void EmptyExportResult_CanSerializeAndDeserialize()
    {
      // Arrange
      var original = new ExportResult();

      // Act
      var bytes = original.ToByteArray();
      var deserialized = ExportResult.Parser.ParseFrom(bytes);

      // Assert
      Assert.NotNull(deserialized);
      Assert.Null(deserialized.Vcards);
    }

    [Fact]
    public void VCardData_WithEmptyList_CanSerializeAndDeserialize()
    {
      // Arrange
      var original = new VCardData();

      // Act
      var bytes = original.ToByteArray();
      var deserialized = VCardData.Parser.ParseFrom(bytes);

      // Assert
      Assert.NotNull(deserialized);
      Assert.Empty(deserialized.Vcards);
    }

    [Fact]
    public void ProtobufSerialization_IsCompact()
    {
      // Arrange
      var response = new CliResponse
      {
        Success = true,
        Command = "ping",
        SimpleResult = "pong"
      };

      // Act
      var bytes = response.ToByteArray();

      // Assert - Binary protobuf should be compact
      Assert.InRange(bytes.Length, 1, 100); // Should be reasonably small
    }
  }
}
