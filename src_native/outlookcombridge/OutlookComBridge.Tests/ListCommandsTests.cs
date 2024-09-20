using NativeBridge.OutlookComBridge;
using NativeBridge.OutlookComBridge.Commands;

namespace OutlookComBridge.Tests
{
  /// <summary>
  /// Tests for the ListCommandsCommand class.
  /// </summary>
  public class ListCommandsTests
  {
    private readonly CliExecutionContext _defaultContext = CliExecutionContext.Default;
    [Fact]
    public void CommandName_ReturnsListCommands()
    {
      // Arrange
      var registry = new CommandRegistry();
      var command = new ListCommandsCommand(registry);

      // Act
      var name = command.CommandName;

      // Assert
      Assert.Equal("list-commands", name, ignoreCase: true);
    }

    [Fact]
    public void Description_IsNotEmpty()
    {
      // Arrange
      var registry = new CommandRegistry();
      var command = new ListCommandsCommand(registry);

      // Act
      var description = command.Description;

      // Assert
      Assert.False(string.IsNullOrWhiteSpace(description));
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsSuccessResponse()
    {
      // Arrange
      var registry = new CommandRegistry();
      var command = new ListCommandsCommand(registry);

      // Act
      var response = await command.ExecuteAsync(Array.Empty<string>(), _defaultContext);

      // Assert
      Assert.True(response.Success);
      Assert.Equal("list-commands", response.Command, ignoreCase: true);
    }

    [Fact]
    public async Task ExecuteAsync_ListsAllCommands()
    {
      // Arrange
      var registry = new CommandRegistry();
      var command = new ListCommandsCommand(registry);

      // Act
      var response = await command.ExecuteAsync(Array.Empty<string>(), _defaultContext);

      // Assert
      Assert.Contains("ping", response.SimpleResult, StringComparison.OrdinalIgnoreCase);
      Assert.Contains("export-contacts", response.SimpleResult, StringComparison.OrdinalIgnoreCase);
      Assert.Contains("list-commands", response.SimpleResult, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ExecuteAsync_IncludesDescriptions()
    {
      // Arrange
      var registry = new CommandRegistry();
      var command = new ListCommandsCommand(registry);

      // Act
      var response = await command.ExecuteAsync(Array.Empty<string>(), _defaultContext);

      // Assert
      // Response should contain command names followed by descriptions
      var lines = response.SimpleResult.Split('\n');
      Assert.All(lines, line =>
      {
        // Each line should have a colon separating command from description
        if (!string.IsNullOrWhiteSpace(line))
        {
          Assert.Contains(":", line);
        }
      });
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsOneLinePerCommand()
    {
      // Arrange
      var registry = new CommandRegistry();
      var command = new ListCommandsCommand(registry);
      var expectedCommandCount = registry.GetAllCommands().Count();

      // Act
      var response = await command.ExecuteAsync(Array.Empty<string>(), _defaultContext);

      // Assert
      var lines = response.SimpleResult.Split('\n', StringSplitOptions.RemoveEmptyEntries);
      Assert.Equal(expectedCommandCount, lines.Length);
    }
  }
}
