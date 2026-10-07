using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;

if (args.Length is < 2 or > 3)
{
    Console.Error.WriteLine("Usage: StripMathcad <input.json> <output.json> [el-tek.json]");
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

var added = 0;
if (args.Length == 3)
    added = MergeElTek(root, catalogs, args[2]);

var text = root.ToJsonString(new JsonSerializerOptions
{
    Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    WriteIndented = false
}).Replace("<", "\\u003c", StringComparison.Ordinal);

File.WriteAllText(args[1], text);
Console.WriteLine($"entries={entries} mathcad_removed={removed} el_tek_added={added} bytes={text.Length}");
return 0;

static int MergeElTek(JsonNode root, JsonArray catalogs, string path)
{
    var extra = JsonNode.Parse(File.ReadAllText(path))?.AsObject()
        ?? throw new InvalidOperationException("El Tek-tillægget er tomt.");
    var catalog = catalogs.Select(c => c?.AsObject()).FirstOrDefault(c => c?["id"]?.GetValue<string>() == "el")
        ?? throw new InvalidOperationException("EL-kataloget blev ikke fundet.");

    var scope = catalog["scope"]?.GetValue<string>() ?? "";
    var replace = extra["scope_replace"]?.AsObject()
        ?? throw new InvalidOperationException("scope_replace mangler.");
    var oldScope = replace["old"]!.GetValue<string>();
    var newScope = replace["new"]!.GetValue<string>();
    if (!scope.Contains(oldScope, StringComparison.Ordinal))
        throw new InvalidOperationException("EL-afgrænsningen matcher ikke tillægget.");
    catalog["scope"] = scope.Replace(oldScope, newScope, StringComparison.Ordinal);

    AddObject(catalog["navigation_groups"]!.AsArray(), extra["group"]!, "id");
    AddMap(catalog["quantities"]!.AsObject(), extra["quantities"]!.AsObject());
    AddMap(catalog["situations"]!.AsObject(), extra["situations"]!.AsObject());
    catalog["given_guides"] ??= new JsonObject();
    var guides = catalog["given_guides"]!.AsObject();
    var guide = extra["given_guide"]?.AsObject() ?? throw new InvalidOperationException("given_guide mangler.");
    var guideId = guide["id"]!.GetValue<string>();
    if (guides.ContainsKey(guideId))
        throw new InvalidOperationException("Vejledning findes allerede: " + guideId);
    guides[guideId] = guide["body"]!.DeepClone();

    var knownIds = catalogs
        .SelectMany(c => c?["entries"]?.AsArray() ?? [])
        .Select(e => e?["id"]?.GetValue<string>())
        .Where(id => id is not null)
        .ToHashSet(StringComparer.Ordinal);
    var list = catalog["entries"]!.AsArray();
    var added = 0;
    foreach (var entry in extra["entries"]!.AsArray())
    {
        var id = entry?["id"]?.GetValue<string>() ?? throw new InvalidOperationException("Opslag uden id.");
        if (!knownIds.Add(id))
            throw new InvalidOperationException("Formelkoden findes allerede: " + id);
        list.Add(entry!.DeepClone());
        added++;
    }

    var notes = catalog["notes"]?.AsArray() ?? new JsonArray();
    catalog["notes"] = notes;
    notes.Add(extra["note"]!.DeepClone());

    var sources = catalog["source_inventory"]!.AsArray();
    AddObject(sources, extra["source"]!, "id");

    var assets = root["math_assets"]?.AsObject() ?? throw new InvalidOperationException("math_assets mangler.");
    var searchText = root["search_text"]?.AsObject() ?? new JsonObject();
    root["search_text"] = searchText;
    foreach (var formula in extra["formulas"]!.AsArray())
    {
        var spec = formula?.AsObject() ?? throw new InvalidOperationException("Formel uden indhold.");
        var latex = spec["latex"]!.GetValue<string>();
        var search = spec["search"]!.GetValue<string>();
        if (assets[latex] is JsonObject existing)
        {
            if (existing["search"]?.GetValue<string>() != search)
                throw new InvalidOperationException("LaTeX findes med en anden søgetekst: " + latex);
            continue;
        }
        assets[latex] = RenderAsset(search, spec["parts"]!.AsArray());
    }

    foreach (var entry in extra["entries"]!.AsArray())
    {
        var obj = entry!.AsObject();
        var id = obj["id"]!.GetValue<string>();
        RequireAsset(assets, obj["latex"]!.GetValue<string>(), id);
        foreach (var field in new[] { "steps", "conversion", "pitfall", "example", "explanation" })
        {
            var value = obj[field]?.GetValue<string>();
            if (string.IsNullOrEmpty(value)) continue;
            var parts = value.Split('$');
            if (parts.Length % 2 == 0)
                throw new InvalidOperationException("Uafsluttet matematik i " + id + " " + field);
            for (var i = 1; i < parts.Length; i += 2)
                RequireAsset(assets, parts[i].Trim(), id);
        }
        searchText[id] = string.Join('\n', new[] { "steps", "conversion", "pitfall", "example", "explanation" }
            .Select(field => obj[field]?.GetValue<string>() ?? ""));
    }

    return added;
}

static void RequireAsset(JsonObject assets, string latex, string id)
{
    if (assets[latex] is null)
        throw new InvalidOperationException($"Mangler formelbillede for {id}: {latex}");
}

static void AddObject(JsonArray list, JsonNode item, string idField)
{
    var id = item[idField]?.GetValue<string>() ?? throw new InvalidOperationException("Mangler " + idField);
    if (list.Any(node => node?[idField]?.GetValue<string>() == id))
        throw new InvalidOperationException(idField + " findes allerede: " + id);
    list.Add(item.DeepClone());
}

static void AddMap(JsonObject target, JsonObject incoming)
{
    foreach (var pair in incoming)
    {
        if (target.ContainsKey(pair.Key))
            throw new InvalidOperationException("Størrelsen findes allerede: " + pair.Key);
        target[pair.Key] = pair.Value!.DeepClone();
    }
}

static JsonObject RenderAsset(string search, JsonArray parts)
{
    const double textSize = 28;
    const double fracSize = 20;
    const double pad = 8;
    var pieces = new List<Piece>();
    foreach (var part in parts)
    {
        var obj = part!.AsObject();
        if (obj.ContainsKey("t"))
        {
            var text = obj["t"]!.GetValue<string>();
            pieces.Add(new Piece(text, null, Measure(text, textSize) + 4));
        }
        else
        {
            var numerator = obj["n"]!.GetValue<string>();
            var denominator = obj["d"]!.GetValue<string>();
            var fracWidth = Math.Max(Measure(numerator, fracSize), Measure(denominator, fracSize)) + 12;
            pieces.Add(new Piece(numerator, denominator, fracWidth));
        }
    }

    var width = pad;
    foreach (var piece in pieces)
        width += piece.Width + 2;
    width += pad;
    const double baseline = 46;
    const double height = 74;
    var svg = new StringBuilder();
    svg.Append("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ");
    svg.Append(width.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture));
    svg.Append(' ');
    svg.Append(height.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture));
    svg.Append("\" width=\"");
    svg.Append(width.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture));
    svg.Append("\" height=\"");
    svg.Append(height.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture));
    svg.Append("\">");
    var x = pad;
    foreach (var piece in pieces)
    {
        if (piece.Denominator is null)
        {
            svg.Append("<text x=\"");
            svg.Append(x.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture));
            svg.Append("\" y=\"");
            svg.Append(baseline.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture));
            svg.Append("\" fill=\"#17324D\" font-size=\"");
            svg.Append(textSize.ToString(System.Globalization.CultureInfo.InvariantCulture));
            svg.Append("\" font-family=\"Cambria Math, Cambria, 'Times New Roman', serif\">");
            svg.Append(Escape(piece.Text));
            svg.Append("</text>");
        }
        else
        {
            var barY = baseline - 8;
            var center = x + piece.Width / 2;
            svg.Append("<text x=\"");
            svg.Append(center.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture));
            svg.Append("\" y=\"");
            svg.Append((barY - 6).ToString("0.##", System.Globalization.CultureInfo.InvariantCulture));
            svg.Append("\" text-anchor=\"middle\" fill=\"#17324D\" font-size=\"");
            svg.Append(fracSize.ToString(System.Globalization.CultureInfo.InvariantCulture));
            svg.Append("\" font-family=\"Cambria Math, Cambria, 'Times New Roman', serif\">");
            svg.Append(Escape(piece.Text));
            svg.Append("</text><line x1=\"");
            svg.Append(x.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture));
            svg.Append("\" y1=\"");
            svg.Append(barY.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture));
            svg.Append("\" x2=\"");
            svg.Append((x + piece.Width).ToString("0.##", System.Globalization.CultureInfo.InvariantCulture));
            svg.Append("\" y2=\"");
            svg.Append(barY.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture));
            svg.Append("\" stroke=\"#17324D\" stroke-width=\"1.6\"/><text x=\"");
            svg.Append(center.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture));
            svg.Append("\" y=\"");
            svg.Append((barY + 22).ToString("0.##", System.Globalization.CultureInfo.InvariantCulture));
            svg.Append("\" text-anchor=\"middle\" fill=\"#17324D\" font-size=\"");
            svg.Append(fracSize.ToString(System.Globalization.CultureInfo.InvariantCulture));
            svg.Append("\" font-family=\"Cambria Math, Cambria, 'Times New Roman', serif\">");
            svg.Append(Escape(piece.Denominator));
            svg.Append("</text>");
        }
        x += piece.Width + 2;
    }
    svg.Append("</svg>");
    var bytes = Encoding.UTF8.GetBytes(svg.ToString());
    return new JsonObject
    {
        ["src"] = "data:image/svg+xml;base64," + Convert.ToBase64String(bytes),
        ["width"] = Math.Round(width, 2),
        ["height"] = Math.Round(height, 2),
        ["search"] = search
    };
}

static string Escape(string value) => value
    .Replace("&", "&amp;", StringComparison.Ordinal)
    .Replace("<", "&lt;", StringComparison.Ordinal)
    .Replace(">", "&gt;", StringComparison.Ordinal);

static double Measure(string text, double size)
{
    double width = 0;
    foreach (var ch in text)
        width += ch is ' ' or '·' or '+' or '-' or '−' or '=' ? size * 0.38 : size * 0.62;
    return Math.Max(width, size);
}

readonly record struct Piece(string Text, string? Denominator, double Width);
