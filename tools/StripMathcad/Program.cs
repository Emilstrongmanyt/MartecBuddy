using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;

if (args.Length != 2)
{
    Console.Error.WriteLine("Usage: StripMathcad <input.json> <output.json>");
    return 1;
}

var root = JsonNode.Parse(File.ReadAllText(args[0])) ?? throw new InvalidOperationException("Tom database.");
var catalogs = root["catalogs"]?.AsArray() ?? throw new InvalidOperationException("Kataloger mangler.");
var entries = 0;
var removed = 0;
foreach (var catalog in catalogs)
{
    var list = catalog?["entries"]?.AsArray();
    if (list is null) continue;
    foreach (var entry in list)
    {
        entries++;
        var obj = entry?.AsObject();
        if (obj is null) continue;
        if (obj.Remove("mathcad")) removed++;
        obj.Remove("mathcad_metadata");
    }
}

if (entries < 100)
    throw new InvalidOperationException($"For få opslag i databasen: {entries}.");
if (removed != entries)
    throw new InvalidOperationException($"Mathcad blev ikke fjernet fra alle opslag ({removed} af {entries}).");

var text = root.ToJsonString(new JsonSerializerOptions
{
    Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    WriteIndented = false
}).Replace("<", "\\u003c");

File.WriteAllText(args[1], text);
Console.WriteLine($"entries={entries} mathcad_removed={removed} bytes={text.Length}");
return 0;
