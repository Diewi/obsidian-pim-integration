using Google.Protobuf;
using NativeBridge;
using NativeBridge.OutlookComBridge;
using NativeBridge.OutlookComBridge.Commands;

namespace OutlookComBridge.Tests
{
  /// <summary>
  /// Tests for the ExportCalendarCommand class.
  /// Uses --test-data mode to avoid requiring actual Outlook interop.
  /// </summary>
  public class ExportCalendarCommandTests
  {
    private readonly CliExecutionContext _testDataContext = new() { UseTestData = true };

    [Fact]
    public void CommandName_ReturnsExportCalendar()
    {
      var command = new ExportCalendarCommand();
      Assert.Equal("export-calendar", command.CommandName, ignoreCase: true);
    }

    [Fact]
    public void Description_IsNotEmpty()
    {
      var command = new ExportCalendarCommand();
      Assert.False(string.IsNullOrWhiteSpace(command.Description));
    }

    [Fact]
    public async Task ExecuteAsync_WithTestData_ReturnsCalendarData()
    {
      var command = new ExportCalendarCommand();
      var response = await command.ExecuteAsync(Array.Empty<string>(), _testDataContext);

      Assert.True(response.Success);
      Assert.Equal("export-calendar", response.Command, ignoreCase: true);
      Assert.NotNull(response.ExportResult);
      Assert.NotNull(response.ExportResult.Calendar);
      Assert.False(string.IsNullOrWhiteSpace(response.ExportResult.Calendar.Ical));
      Assert.Equal(TestData.TestICalendarEventCount, response.ExportResult.Calendar.EventCount);
    }

    [Fact]
    public async Task ExecuteAsync_WithTestData_ContainsValidICalStructure()
    {
      var command = new ExportCalendarCommand();
      var response = await command.ExecuteAsync(Array.Empty<string>(), _testDataContext);

      var ical = response.ExportResult.Calendar.Ical;
      Assert.Contains("BEGIN:VCALENDAR", ical);
      Assert.Contains("END:VCALENDAR", ical);
      Assert.Contains("BEGIN:VEVENT", ical);
      Assert.Contains("END:VEVENT", ical);
      Assert.Contains("VERSION:2.0", ical);
    }

    [Fact]
    public async Task ExecuteAsync_WithTestData_ContainsExpectedEvents()
    {
      var command = new ExportCalendarCommand();
      var response = await command.ExecuteAsync(Array.Empty<string>(), _testDataContext);

      var ical = response.ExportResult.Calendar.Ical;
      Assert.Contains("SUMMARY:Team Standup", ical);
      Assert.Contains("SUMMARY:Project Review", ical);
      Assert.Contains("SUMMARY:Lunch with Müller & Associés", ical);
    }

    [Fact]
    public async Task ExecuteAsync_WithTestData_ContainsSpecialCharacters()
    {
      var command = new ExportCalendarCommand();
      var response = await command.ExecuteAsync(Array.Empty<string>(), _testDataContext);

      var ical = response.ExportResult.Calendar.Ical;
      Assert.Contains("Müller", ical);
      Assert.Contains("Associés", ical);
      Assert.Contains("Ångström", ical);
      Assert.Contains("München", ical);
      Assert.Contains("Königshof", ical);
    }

    [Fact]
    public async Task ExecuteAsync_WithTestData_SetsTimestamp()
    {
      var command = new ExportCalendarCommand();
      var before = DateTimeOffset.UtcNow.Ticks;

      var response = await command.ExecuteAsync(Array.Empty<string>(), _testDataContext);

      var after = DateTimeOffset.UtcNow.Ticks;
      Assert.InRange(response.Timestamp, before, after);
    }

    [Fact]
    public async Task ExecuteAsync_WithoutParams_ReturnsError()
    {
      // Non-test-data context with no request params should fail
      var context = CliExecutionContext.Default;
      var command = new ExportCalendarCommand();

      var response = await command.ExecuteAsync(Array.Empty<string>(), context);

      Assert.False(response.Success);
      Assert.Contains("CalendarExportParams", response.ErrorMessage);
    }

    [Fact]
    public async Task ExecuteAsync_WithRequestParams_InTestMode_IgnoresParams()
    {
      // When UseTestData is true, the command returns test data regardless of params
      var context = new CliExecutionContext
      {
        UseTestData = true,
        Request = new CliRequest
        {
          CalendarExport = new CalendarExportParams
          {
            StartDate = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc).Ticks,
            EndDate = new DateTime(2026, 1, 31, 0, 0, 0, DateTimeKind.Utc).Ticks,
            IncludePrivate = true
          }
        }
      };

      var command = new ExportCalendarCommand();
      var response = await command.ExecuteAsync(Array.Empty<string>(), context);

      Assert.True(response.Success);
      Assert.NotNull(response.ExportResult.Calendar);
      // Should still be the test data
      Assert.Contains("Team Standup", response.ExportResult.Calendar.Ical);
    }
  }

  /// <summary>
  /// Tests for calendar-related protobuf serialization.
  /// </summary>
  public class CalendarProtobufSerializationTests
  {
    [Fact]
    public void CliRequest_WithCalendarParams_CanSerializeAndDeserialize()
    {
      var original = new CliRequest
      {
        CalendarExport = new CalendarExportParams
        {
          StartDate = new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc).Ticks,
          EndDate = new DateTime(2026, 4, 30, 23, 59, 59, DateTimeKind.Utc).Ticks,
          IncludePrivate = true
        }
      };

      var bytes = original.ToByteArray();
      var deserialized = CliRequest.Parser.ParseFrom(bytes);

      Assert.NotNull(deserialized.CalendarExport);
      Assert.Equal(original.CalendarExport.StartDate, deserialized.CalendarExport.StartDate);
      Assert.Equal(original.CalendarExport.EndDate, deserialized.CalendarExport.EndDate);
      Assert.Equal(original.CalendarExport.IncludePrivate, deserialized.CalendarExport.IncludePrivate);
    }

    [Fact]
    public void CliRequest_WithContactParams_CanSerializeAndDeserialize()
    {
      var original = new CliRequest
      {
        ContactExport = new ContactExportParams
        {
          FolderName = "Shared Contacts"
        }
      };

      var bytes = original.ToByteArray();
      var deserialized = CliRequest.Parser.ParseFrom(bytes);

      Assert.NotNull(deserialized.ContactExport);
      Assert.Equal("Shared Contacts", deserialized.ContactExport.FolderName);
    }

    [Fact]
    public void CalendarData_CanSerializeAndDeserialize()
    {
      var original = new CalendarData
      {
        Ical = TestData.TestICalendar,
        EventCount = TestData.TestICalendarEventCount
      };

      var bytes = original.ToByteArray();
      var deserialized = CalendarData.Parser.ParseFrom(bytes);

      Assert.Equal(original.Ical, deserialized.Ical);
      Assert.Equal(original.EventCount, deserialized.EventCount);
    }

    [Fact]
    public void ExportResult_WithCalendar_CanSerializeAndDeserialize()
    {
      var original = TestData.GetTestCalendarExportResult();

      var bytes = original.ToByteArray();
      var deserialized = ExportResult.Parser.ParseFrom(bytes);

      Assert.NotNull(deserialized.Calendar);
      Assert.Equal(original.Calendar.Ical, deserialized.Calendar.Ical);
      Assert.Equal(original.Calendar.EventCount, deserialized.Calendar.EventCount);
    }

    [Fact]
    public void CliResponse_WithCalendarExportResult_CanSerializeAndDeserialize()
    {
      var original = new CliResponse
      {
        Success = true,
        Command = "export-calendar",
        Timestamp = DateTimeOffset.UtcNow.Ticks,
        ExportResult = TestData.GetTestCalendarExportResult()
      };

      var bytes = original.ToByteArray();
      var deserialized = CliResponse.Parser.ParseFrom(bytes);

      Assert.True(deserialized.Success);
      Assert.Equal("export-calendar", deserialized.Command);
      Assert.NotNull(deserialized.ExportResult.Calendar);
      Assert.Contains("BEGIN:VCALENDAR", deserialized.ExportResult.Calendar.Ical);
      Assert.Equal(TestData.TestICalendarEventCount, deserialized.ExportResult.Calendar.EventCount);
    }

    [Fact]
    public void LengthPrefixed_CalendarResponse_WorksCorrectly()
    {
      var response = new CliResponse
      {
        Success = true,
        Command = "export-calendar",
        Timestamp = DateTimeOffset.UtcNow.Ticks,
        ExportResult = TestData.GetTestCalendarExportResult()
      };

      // Simulate length-prefixed protocol
      var payload = response.ToByteArray();
      var lengthPrefix = BitConverter.GetBytes((uint)payload.Length);
      var fullMessage = new byte[4 + payload.Length];
      Buffer.BlockCopy(lengthPrefix, 0, fullMessage, 0, 4);
      Buffer.BlockCopy(payload, 0, fullMessage, 4, payload.Length);

      // Parse back
      var readLength = BitConverter.ToUInt32(fullMessage, 0);
      var readPayload = new byte[readLength];
      Buffer.BlockCopy(fullMessage, 4, readPayload, 0, (int)readLength);
      var deserialized = CliResponse.Parser.ParseFrom(readPayload);

      Assert.Equal(payload.Length, (int)readLength);
      Assert.True(deserialized.Success);
      Assert.NotNull(deserialized.ExportResult.Calendar);
      Assert.Contains("Team Standup", deserialized.ExportResult.Calendar.Ical);
    }

    [Fact]
    public void CliRequest_CalendarParams_JsonRoundTrip()
    {
      var original = new CliRequest
      {
        CalendarExport = new CalendarExportParams
        {
          StartDate = new DateTime(2026, 4, 1, 0, 0, 0, DateTimeKind.Utc).Ticks,
          EndDate = new DateTime(2026, 4, 30, 0, 0, 0, DateTimeKind.Utc).Ticks,
          IncludePrivate = false
        }
      };

      // Serialize to JSON
      var formatter = new Google.Protobuf.JsonFormatter(
        new Google.Protobuf.JsonFormatter.Settings(true)
      );
      var json = formatter.Format(original);

      // Parse back from JSON
      var parser = new Google.Protobuf.JsonParser(Google.Protobuf.JsonParser.Settings.Default);
      var deserialized = parser.Parse<CliRequest>(json);

      Assert.NotNull(deserialized.CalendarExport);
      Assert.Equal(original.CalendarExport.StartDate, deserialized.CalendarExport.StartDate);
      Assert.Equal(original.CalendarExport.EndDate, deserialized.CalendarExport.EndDate);
      Assert.Equal(original.CalendarExport.IncludePrivate, deserialized.CalendarExport.IncludePrivate);
    }
  }

  /// <summary>
  /// Tests for the OutlookCalendarBridge helper methods.
  /// </summary>
  public class OutlookCalendarBridgeTests
  {
    [Fact]
    public void CountEvents_ReturnsCorrectCount()
    {
      Assert.Equal(TestData.TestICalendarEventCount,
        OutlookCalendarBridge.CountEvents(TestData.TestICalendar));
    }

    [Fact]
    public void CountEvents_ReturnsZero_ForEmptyCalendar()
    {
      var empty = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n";
      Assert.Equal(0, OutlookCalendarBridge.CountEvents(empty));
    }

    [Fact]
    public void CountEvents_ReturnsOne_ForSingleEvent()
    {
      var single = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Test\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
      Assert.Equal(1, OutlookCalendarBridge.CountEvents(single));
    }
  }

  /// <summary>
  /// Tests for the CommandRegistry including the new export-calendar command.
  /// </summary>
  public class CommandRegistryCalendarTests
  {
    [Fact]
    public void Registry_ContainsExportCalendarCommand()
    {
      var registry = new CommandRegistry();
      var command = registry.GetCommand("export-calendar");
      Assert.NotNull(command);
      Assert.Equal("export-calendar", command.CommandName, ignoreCase: true);
    }

    [Fact]
    public async Task Registry_ExecuteExportCalendar_WithTestData()
    {
      var registry = new CommandRegistry();
      var context = new CliExecutionContext { UseTestData = true };
      var response = await registry.ExecuteCommandAsync("export-calendar", Array.Empty<string>(), context);

      Assert.True(response.Success);
      Assert.NotNull(response.ExportResult.Calendar);
      Assert.Contains("BEGIN:VCALENDAR", response.ExportResult.Calendar.Ical);
    }

    [Fact]
    public async Task ListCommands_IncludesExportCalendar()
    {
      var registry = new CommandRegistry();
      var context = CliExecutionContext.Default;
      var response = await registry.ExecuteCommandAsync("list-commands", Array.Empty<string>(), context);

      Assert.Contains("export-calendar", response.SimpleResult, StringComparison.OrdinalIgnoreCase);
    }
  }
}
