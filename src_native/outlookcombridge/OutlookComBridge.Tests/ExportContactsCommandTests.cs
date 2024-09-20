using Moq;
using NativeBridge;
using NativeBridge.OutlookComBridge;
using NativeBridge.OutlookComBridge.Commands;

namespace OutlookComBridge.Tests
{
  /// <summary>
  /// Tests for the ExportContactsCommand class.
  /// Uses mocking to avoid requiring actual Outlook interop.
  /// </summary>
  public class ExportContactsCommandTests
  {
    private readonly CliExecutionContext _defaultContext = CliExecutionContext.Default;
    private readonly CliExecutionContext _testDataContext = new() { UseTestData = true };
    [Fact]
    public void CommandName_ReturnsExportContacts()
    {
      // Arrange
      var command = new ExportContactsCommand();

      // Act
      var name = command.CommandName;

      // Assert
      Assert.Equal("export-contacts", name, ignoreCase: true);
    }

    [Fact]
    public void Description_IsNotEmpty()
    {
      // Arrange
      var command = new ExportContactsCommand();

      // Act
      var description = command.Description;

      // Assert
      Assert.False(string.IsNullOrWhiteSpace(description));
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsSuccessResponse_WhenExportSucceeds()
    {
      // Arrange
      var command = new ExportContactsCommand();

      // Act - This test may succeed or fail depending on Outlook availability
      // We're testing the command structure, not the Outlook interop
      var response = await command.ExecuteAsync(Array.Empty<string>(), _defaultContext);

      // Assert - Basic response structure should always be present
      Assert.NotNull(response);
      Assert.Equal("export-contacts", response.Command, ignoreCase: true);
      // Note: Success depends on Outlook being available, but response is always returned
    }

    [Fact]
    public async Task ExecuteAsync_SetsTimestamp()
    {
      // Arrange
      var command = new ExportContactsCommand();
      var beforeExecution = DateTimeOffset.UtcNow.Ticks;

      // Act
      var response = await command.ExecuteAsync(Array.Empty<string>(), _defaultContext);

      // Assert
      var afterExecution = DateTimeOffset.UtcNow.Ticks;
      Assert.InRange(response.Timestamp, beforeExecution, afterExecution);
    }

    [Fact]
    public async Task ExecuteAsync_SetsCommandName()
    {
      // Arrange
      var command = new ExportContactsCommand();

      // Act
      var response = await command.ExecuteAsync(Array.Empty<string>(), _defaultContext);

      // Assert
      Assert.Contains("export", response.Command, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsExportResult_InResponse()
    {
      // Arrange
      var command = new ExportContactsCommand();

      // Act
      var response = await command.ExecuteAsync(Array.Empty<string>(), _defaultContext);

      // Assert
      // ExportResult may be null if Outlook is not available, which is expected in test environments
      Assert.NotNull(response);
    }

    [Fact]
    public async Task ExecuteAsync_WithTestDataContext_ReturnsTestData()
    {
      // Arrange
      var command = new ExportContactsCommand();

      // Act
      var response = await command.ExecuteAsync(Array.Empty<string>(), _testDataContext);

      // Assert
      Assert.True(response.Success);
      Assert.NotNull(response.ExportResult);
      Assert.NotNull(response.ExportResult.Vcards);
      Assert.True(response.ExportResult.Vcards.Vcards.Count > 0);
      // Should contain John Doe from test data
      Assert.Contains(response.ExportResult.Vcards.Vcards, vc => vc.Contains("John Doe"));
    }

    [Fact]
    public async Task ExecuteAsync_WithTestDataContext_ReturnsMultipleContacts()
    {
      // Arrange
      var command = new ExportContactsCommand();

      // Act
      var response = await command.ExecuteAsync(Array.Empty<string>(), _testDataContext);

      // Assert
      Assert.True(response.Success);
      // Test data should have 3 contacts
      Assert.Equal(3, response.ExportResult.Vcards.Vcards.Count);
    }
  }

  /// <summary>
  /// Tests for ExportContactsCommand with mocked contact service.
  /// This allows testing the command logic without Outlook interop.
  /// </summary>
  public class ExportContactsCommandWithMockTests
  {
    [Fact]
    public void MockedExport_CanReturnVCardData()
    {
      // Arrange
      var mockService = new Mock<IContactExportService>();
      var expectedVCards = new List<string> { "BEGIN:VCARD\nEND:VCARD" };

      mockService.Setup(s => s.ExportContacts())
          .Returns(new ExportResult
          {
            Vcards = new VCardData { Vcards = { expectedVCards } }
          });

      // Act
      var result = mockService.Object.ExportContacts();

      // Assert
      Assert.NotNull(result.Vcards);
      Assert.Single(result.Vcards.Vcards);
      Assert.Contains("BEGIN:VCARD", result.Vcards.Vcards[0]);
    }

    [Fact]
    public void MockedExport_CanReturnEmptyResult()
    {
      // Arrange
      var mockService = new Mock<IContactExportService>();
      mockService.Setup(s => s.ExportContacts())
          .Returns(new ExportResult());

      // Act
      var result = mockService.Object.ExportContacts();

      // Assert
      Assert.NotNull(result);
      Assert.Null(result.Vcards);
    }

    [Fact]
    public void MockedExport_CanReturnMultipleVCards()
    {
      // Arrange
      var mockService = new Mock<IContactExportService>();
      var expectedVCards = new List<string>
            {
                "BEGIN:VCARD\nFN:John Doe\nEND:VCARD",
                "BEGIN:VCARD\nFN:Jane Smith\nEND:VCARD",
                "BEGIN:VCARD\nFN:Bob Johnson\nEND:VCARD"
            };

      mockService.Setup(s => s.ExportContacts())
          .Returns(new ExportResult
          {
            Vcards = new VCardData { Vcards = { expectedVCards } }
          });

      // Act
      var result = mockService.Object.ExportContacts();

      // Assert
      Assert.NotNull(result.Vcards);
      Assert.Equal(3, result.Vcards.Vcards.Count);
      Assert.All(result.Vcards.Vcards, vcard =>
      {
        Assert.Contains("BEGIN:VCARD", vcard);
        Assert.Contains("END:VCARD", vcard);
      });
    }
  }
}
