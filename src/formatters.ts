const PLATFORMS = ["android", "ios", "web", "ios_hd", "ios_plus", "harmony"];

export function formatKeyList(data: any[]): string {
  if (!data || data.length === 0) return "No keys found for this platform.";

  const lines: string[] = [`Found ${data.length} key(s):\n`];
  for (const item of data) {
    let label = `  - ${item.key}`;
    if (item.note) label += ` (${item.note})`;
    if (item.child_keys && item.child_keys.length > 0) {
      const childNames = item.child_keys.map((c: any) => c.key).join(", ");
      label += ` [children: ${childNames}]`;
    }
    lines.push(label);
  }
  return lines.join("\n");
}

export function formatConfigDetail(data: any): string {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return "No configuration found.";
  }

  const config = Array.isArray(data) ? data[0] : data;
  const lines: string[] = [];

  lines.push(`# Key: ${config.key}`);
  lines.push("");
  if (config.note) lines.push(`**Note:** ${config.note}`);
  if (config.notion) lines.push(`**Notion:** ${config.notion}`);
  if (config.gray_plan) lines.push(`**Gray Plan:** ${config.gray_plan}`);
  lines.push(`**Value Type:** ${config.value_type || "N/A"}`);
  lines.push(`**Default Value:** ${config.value_default ?? "N/A"}`);
  if (config.abtest) lines.push(`**AB Test:** ${config.abtest === "1" ? "Yes" : "No"}`);
  if (config.ip_country_first !== undefined) {
    lines.push(`**IP Country First:** ${config.ip_country_first ? "Yes" : "No"}`);
  }
  if (config.create_time) lines.push(`**Created:** ${formatTimestamp(config.create_time)}`);
  if (config.update_time) lines.push(`**Updated:** ${formatTimestamp(config.update_time)}`);

  if (config.conditions && config.conditions.length > 0) {
    lines.push("");
    lines.push("## Display Conditions");
    for (let i = 0; i < config.conditions.length; i++) {
      lines.push(`\n### Condition ${i + 1}`);
      lines.push(formatCondition(config.conditions[i]));
    }
  }

  if (config.value_list && config.value_list.length > 0) {
    lines.push("");
    lines.push("## Value List");
    for (let i = 0; i < config.value_list.length; i++) {
      const v = config.value_list[i];
      lines.push(`\n### Value ${i + 1}: \`${v.value}\``);
      if (v.conditions && v.conditions.length > 0) {
        for (let j = 0; j < v.conditions.length; j++) {
          lines.push(`  Condition ${j + 1}:`);
          lines.push(formatCondition(v.conditions[j], "    "));
        }
      }
    }
  }

  if (config.child_keys && config.child_keys.length > 0) {
    lines.push("");
    lines.push("## Child Keys");
    for (const child of config.child_keys) {
      lines.push(`\n### Child: ${child.key}`);
      lines.push(formatChildKey(child, 1));
    }
  }

  return lines.join("\n");
}

function formatChildKey(child: any, depth: number): string {
  const indent = "  ".repeat(depth);
  const lines: string[] = [];

  if (child.note) lines.push(`${indent}Note: ${child.note}`);
  if (child.value_type) lines.push(`${indent}Value Type: ${child.value_type}`);
  if (child.value_default !== undefined) lines.push(`${indent}Default: ${child.value_default}`);

  if (child.conditions && child.conditions.length > 0) {
    lines.push(`${indent}Conditions:`);
    for (let i = 0; i < child.conditions.length; i++) {
      lines.push(`${indent}  Condition ${i + 1}:`);
      lines.push(formatCondition(child.conditions[i], indent + "    "));
    }
  }

  if (child.value_list && child.value_list.length > 0) {
    lines.push(`${indent}Value List:`);
    for (const v of child.value_list) {
      lines.push(`${indent}  Value: ${v.value}`);
      if (v.conditions) {
        for (const c of v.conditions) {
          lines.push(formatCondition(c, indent + "    "));
        }
      }
    }
  }

  if (child.child_keys && child.child_keys.length > 0 && depth < 3) {
    for (const subChild of child.child_keys) {
      lines.push(`${indent}  Sub-child: ${subChild.key}`);
      lines.push(formatChildKey(subChild, depth + 1));
    }
  }

  return lines.join("\n");
}

function formatCondition(condition: any, indent: string = "  "): string {
  const lines: string[] = [];
  const skip = new Set(["show", "key_mes", "select_key"]);

  for (const [key, value] of Object.entries(condition)) {
    if (skip.has(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    lines.push(`${indent}${key}: ${value}`);
  }

  return lines.length > 0 ? lines.join("\n") : `${indent}(empty)`;
}

export function formatHistoryList(data: any): string {
  if (!data || !data.data || data.data.length === 0) {
    return "No history records found.";
  }

  const lines: string[] = [`Total: ${data.total || data.data.length} record(s)\n`];

  for (let i = 0; i < data.data.length; i++) {
    const item = data.data[i];
    lines.push(`--- Record ${i + 1} ---`);
    lines.push(`  ID: ${item.id || item._id}`);
    lines.push(`  Key: ${item.key || "N/A"}`);
    lines.push(`  Platform: ${item.platform || "N/A"}`);
    if (item.account) lines.push(`  Operator: ${item.account}`);
    if (item.create_time) lines.push(`  Time: ${formatTimestamp(item.create_time)}`);
    if (item.data) {
      try {
        const parsed = typeof item.data === "string" ? JSON.parse(item.data) : item.data;
        lines.push(`  Value Type: ${parsed.value_type || "N/A"}`);
        lines.push(`  Default: ${parsed.value_default ?? "N/A"}`);
      } catch {
        lines.push(`  Data: (raw JSON)`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function formatTestList(data: any): string {
  if (!data) return "No AB test data found.";

  let list: any[];
  try {
    list = typeof data.data === "string" ? JSON.parse(data.data).list : data.data;
  } catch {
    return "Failed to parse AB test list.";
  }

  if (!list || list.length === 0) return "No AB tests found.";

  const lines: string[] = [`Found ${list.length} AB test(s):\n`];
  for (const test of list.slice(0, 50)) {
    lines.push(`  - ${test.abname || test.name || "unnamed"}`);
    if (test.remark) lines.push(`    Remark: ${test.remark}`);
    if (test.groups) lines.push(`    Groups: ${JSON.stringify(test.groups)}`);
  }
  if (list.length > 50) lines.push(`  ... and ${list.length - 50} more`);

  return lines.join("\n");
}

function formatTimestamp(ts: number): string {
  if (!ts) return "N/A";
  const d = ts > 1e12 ? new Date(ts) : new Date(ts * 1000);
  return d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

export function formatPlatforms(): string {
  return `Supported platforms:\n${PLATFORMS.map(p => `  - ${p}`).join("\n")}`;
}
