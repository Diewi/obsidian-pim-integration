namespace NativeBridge.OutlookComBridge
{
  /// <summary>
  /// Provides static test data for CLI commands when --test-data flag is used.
  /// This enables integration testing across language boundaries using protobuf.
  /// </summary>
  public static class TestData
  {
    /// <summary>
    /// Normalize line endings to CRLF as required by RFC 6350 (vCard format).
    /// C# verbatim string literals inherit line endings from the source file,
    /// which may be LF-only depending on the editor/git config.
    /// </summary>
    private static string NormalizeVCardLineEndings(string vcard)
    {
      return vcard.Replace("\r\n", "\n").Replace("\n", "\r\n");
    }

    /// <summary>
    /// Sample John Doe vCard for testing contact export functionality.
    /// This vCard contains common fields used in contact management.
    /// </summary>
    public const string JohnDoeVCard = @"BEGIN:VCARD
VERSION:3.0
N:Doe;John;;;
FN:John Doe
ORG:Test Company Inc.
TITLE:Software Engineer
TEL;TYPE=WORK,VOICE:+1-555-123-4567
TEL;TYPE=CELL:+1-555-987-6543
TEL;TYPE=HOME:+1-555-456-7890
EMAIL;TYPE=WORK:john.doe@testcompany.com
EMAIL;TYPE=HOME:johndoe@personal.example.com
ADR;TYPE=WORK:;;123 Business Ave;Springfield;IL;62701;USA
ADR;TYPE=HOME:;;456 Home Street;Springfield;IL;62702;USA
URL:https://www.johndoe.example.com
BDAY:1985-03-15
NOTE:This is a test contact for integration testing purposes.
END:VCARD";

    /// <summary>
    /// Sample Jane Smith vCard for testing multiple contact scenarios.
    /// </summary>
    public const string JaneSmithVCard = @"BEGIN:VCARD
VERSION:3.0
N:Smith;Jane;;;
FN:Jane Smith
ORG:Another Company LLC
TITLE:Project Manager
TEL;TYPE=WORK,VOICE:+1-555-222-3333
TEL;TYPE=CELL:+1-555-444-5555
EMAIL;TYPE=WORK:jane.smith@anothercompany.com
ADR;TYPE=WORK:;;789 Corporate Blvd;Chicago;IL;60601;USA
END:VCARD";

    /// <summary>
    /// Sample Bob Johnson vCard for testing multiple contact scenarios.
    /// </summary>
    public const string BobJohnsonVCard = @"BEGIN:VCARD
VERSION:3.0
N:Johnson;Bob;;;
FN:Bob Johnson
ORG:Tech Solutions
TITLE:CTO
TEL;TYPE=WORK,VOICE:+1-555-666-7777
EMAIL;TYPE=WORK:bob.johnson@techsolutions.example.com
END:VCARD";

    /// <summary>
    /// Sample vCard with special/non-ASCII characters for testing Unicode handling
    /// across the protobuf bridge. Includes German umlauts, French accents,
    /// Nordic characters, CJK, and Cyrillic.
    /// </summary>
    public const string SpecialCharsVCard = @"BEGIN:VCARD
VERSION:3.0
N:Müller-Lüdenscheidt;François;José;Dr.;
FN:Dr. François José Müller-Lüdenscheidt
ORG:Ångström & Associés GmbH
TITLE:Geschäftsführer
TEL;TYPE=WORK,VOICE:+49-30-123456
EMAIL;TYPE=WORK:francois@angstroem-associes.example.com
ADR;TYPE=WORK:;;Königstraße 42;München;Bayern;80331;Deutschland
NOTE:Spëcîal chars: äöüß éèêë ñ ø å æ 日本語 中文 кириллица
END:VCARD";

    /// <summary>
    /// Gets an ExportResult containing test contact data with individual vCards.
    /// </summary>
    /// <returns>ExportResult with test vCards as list</returns>
    public static NativeBridge.ExportResult GetTestExportResult()
    {
      var vcards = new List<string>
            {
                NormalizeVCardLineEndings(JohnDoeVCard),
                NormalizeVCardLineEndings(JaneSmithVCard),
                NormalizeVCardLineEndings(BobJohnsonVCard),
                NormalizeVCardLineEndings(SpecialCharsVCard)
            };

      // Note: ExportResult uses oneof, so only one of vcards or mergedVcards can be set.
      // For TypeScript tests that need to parse individual vCards, we set the vcards field.
      return new NativeBridge.ExportResult
      {
        Vcards = new NativeBridge.VCardData { Vcards = { vcards } }
      };
    }

    /// <summary>
    /// Gets an ExportResult containing test contact data as merged vCards string.
    /// </summary>
    /// <returns>ExportResult with merged vCards string</returns>
    public static NativeBridge.ExportResult GetTestExportResultMerged()
    {
      var vcards = new List<string>
            {
                NormalizeVCardLineEndings(JohnDoeVCard),
                NormalizeVCardLineEndings(JaneSmithVCard),
                NormalizeVCardLineEndings(BobJohnsonVCard),
                NormalizeVCardLineEndings(SpecialCharsVCard)
            };

      var mergedVcards = string.Join("\r\n", vcards);

      return new NativeBridge.ExportResult
      {
        MergedVcards = mergedVcards
      };
    }

    /// <summary>
    /// Gets an ExportResult containing only the John Doe contact.
    /// Useful for simple single-contact test scenarios.
    /// </summary>
    /// <returns>ExportResult with single John Doe vCard</returns>
    public static NativeBridge.ExportResult GetSingleContactTestResult()
    {
      // Uses vcards field (list) for individual vCard access
      return new NativeBridge.ExportResult
      {
        Vcards = new NativeBridge.VCardData { Vcards = { NormalizeVCardLineEndings(JohnDoeVCard) } }
      };
    }

    /// <summary>
    /// Gets an ExportResult containing only the John Doe contact as merged string.
    /// </summary>
    /// <returns>ExportResult with single John Doe vCard as merged string</returns>
    public static NativeBridge.ExportResult GetSingleContactTestResultMerged()
    {
      return new NativeBridge.ExportResult
      {
        MergedVcards = NormalizeVCardLineEndings(JohnDoeVCard)
      };
    }

    // ========================================================================
    // Calendar test data
    // ========================================================================

    /// <summary>
    /// Sample iCalendar string with two events for testing calendar export.
    /// Uses RFC 5545 format with CRLF line endings.
    /// The date range is 2026-04-01 to 2026-04-30.
    /// </summary>
    public const string TestICalendar = "BEGIN:VCALENDAR\r\n" +
      "VERSION:2.0\r\n" +
      "PRODID:-//OutlookComBridge//Test//EN\r\n" +
      "METHOD:PUBLISH\r\n" +
      "BEGIN:VEVENT\r\n" +
      "DTSTART:20260410T090000Z\r\n" +
      "DTEND:20260410T100000Z\r\n" +
      "SUMMARY:Team Standup\r\n" +
      "DESCRIPTION:Daily standup meeting with the engineering team.\r\n" +
      "LOCATION:Conference Room A\r\n" +
      "UID:test-event-001@outlookcombridge\r\n" +
      "END:VEVENT\r\n" +
      "BEGIN:VEVENT\r\n" +
      "DTSTART:20260415T140000Z\r\n" +
      "DTEND:20260415T153000Z\r\n" +
      "SUMMARY:Project Review\r\n" +
      "DESCRIPTION:Quarterly project review with stakeholders.\r\n" +
      "LOCATION:Board Room\r\n" +
      "UID:test-event-002@outlookcombridge\r\n" +
      "END:VEVENT\r\n" +
      "BEGIN:VEVENT\r\n" +
      "DTSTART:20260420T110000Z\r\n" +
      "DTEND:20260420T120000Z\r\n" +
      "SUMMARY:Lunch with Müller & Associés\r\n" +
      "DESCRIPTION:Business lunch — discuss Ångström project timeline.\r\n" +
      "LOCATION:Restaurant Königshof, München\r\n" +
      "UID:test-event-003@outlookcombridge\r\n" +
      "END:VEVENT\r\n" +
      "END:VCALENDAR\r\n";

    /// <summary>
    /// Number of VEVENT components in TestICalendar.
    /// </summary>
    public const int TestICalendarEventCount = 3;

    /// <summary>
    /// Gets an ExportResult containing test calendar data.
    /// </summary>
    public static NativeBridge.ExportResult GetTestCalendarExportResult()
    {
      return new NativeBridge.ExportResult
      {
        Calendar = new NativeBridge.CalendarData
        {
          Ical = TestICalendar,
          EventCount = TestICalendarEventCount
        }
      };
    }
  }
}
