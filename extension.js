const vscode = require('vscode');

// Units supported across Typst, CSS, HTML, JS/TS, Python, etc.
const UNIT_REGEX_PART = '%|px|rem|em|vh|vw|vmin|vmax|dvh|dvw|svh|svw|lvh|lvw|ch|ex|pt|mm|cm|in|pc|deg|rad|grad|turn|s|ms|fr';
const NUMBER_REGEX = new RegExp(
  `(?<![\\w#])(-?\\d+(?:\\.\\d+)?)(?:(${UNIT_REGEX_PART})\\b|(?![a-zA-Z_]))`,
  'g'
);

function activate(context) {
  // 1. Hover Provider: Mini-contrôleur visuel directement sous la souris
  const hoverProvider = vscode.languages.registerHoverProvider({ scheme: 'file' }, {
    provideHover(document, position) {
      const found = findNumberAt(document, position);
      if (!found) return null;

      const contents = new vscode.MarkdownString();
      contents.isTrusted = true;
      contents.supportHtml = true;

      const val = found.value;
      const unit = found.unit;
      const bounds = computeBounds(val, unit);

      // Header with current value
      contents.appendMarkdown(`### 🎚️ **Number Slider** &nbsp;\`${found.fullText}\`\n\n`);

      const makeSetLink = (lbl, val) => {
        const cmdArgs = encodeURIComponent(JSON.stringify({
          line: found.range.start.line,
          start: found.range.start.character,
          value: val
        }));
        return `[ ${lbl} ](command:numberSlider.set?${cmdArgs})`;
      };

      const makeStepLink = (lbl, delta) => {
        const cmdArgs = encodeURIComponent(JSON.stringify({
          line: found.range.start.line,
          start: found.range.start.character,
          delta
        }));
        return `[ ${lbl} ](command:numberSlider.step?${cmdArgs})`;
      };

      // Mini visual slider track with clickable presets
      const presets = generateTrackPresets(val, unit, bounds.min, bounds.max);
      contents.appendMarkdown(`**Réglette :** &nbsp;`);
      presets.forEach(p => {
        const isCurrent = Math.abs(p - val) < (bounds.max - bounds.min) / 20;
        const label = isCurrent ? `**● ${p}${unit}**` : `${p}${unit}`;
        contents.appendMarkdown(`${makeSetLink(label, p)} `);
      });
      contents.appendMarkdown(`\n\n`);

      // Step buttons right under the mouse
      const steps = computeStepSizes(val, unit);
      contents.appendMarkdown(`**Ajuster :** &nbsp;`);
      contents.appendMarkdown(`${makeStepLink(`◀◀ -${steps.s4}`, -steps.s4)} `);
      contents.appendMarkdown(`${makeStepLink(`◀ -${steps.s3}`, -steps.s3)} `);
      contents.appendMarkdown(`${makeStepLink(`‹ -${steps.s1}`, -steps.s1)} `);
      contents.appendMarkdown(`&nbsp;**\`${val}${unit}\`**&nbsp; `);
      contents.appendMarkdown(`${makeStepLink(`+${steps.s1} ›`, steps.s1)} `);
      contents.appendMarkdown(`${makeStepLink(`+${steps.s3} ▶`, steps.s3)} `);
      contents.appendMarkdown(`${makeStepLink(`+${steps.s4} ▶▶`, steps.s4)}\n\n`);

      contents.appendMarkdown(`---\n`);
      contents.appendMarkdown(`*Ajuster au clavier :* \`Alt + ←\` / \`Alt + →\` &nbsp;|&nbsp; *(Shift : x10)*`);

      return new vscode.Hover(contents, found.range);
    }
  });
  context.subscriptions.push(hoverProvider);

  // 2. Command: Set exact value
  const setHandler = async (args) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !args || typeof args.value !== 'number') return;

    let found = null;
    if (args.line !== undefined && args.start !== undefined) {
      found = findNumberAt(editor.document, new vscode.Position(args.line, args.start));
    }
    if (!found) {
      found = findNumberAt(editor.document, editor.selection.active);
    }
    if (!found) return;

    const newText = `${args.value}${found.unit}`;
    await editor.edit(editBuilder => {
      editBuilder.replace(found.range, newText);
    });
    editor.selection = new vscode.Selection(
      found.range.start,
      new vscode.Position(found.range.start.line, found.range.start.character + newText.length)
    );
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('numberSlider.set', setHandler),
    vscode.commands.registerCommand('typst-slider.set', setHandler)
  );

  // 3. Command: Step (arbitrary delta)
  const stepHandler = async (args) => {
    const delta = args && typeof args.delta === 'number' ? args.delta : 1;
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    let found = null;
    if (args && args.line !== undefined && args.start !== undefined) {
      found = findNumberAt(editor.document, new vscode.Position(args.line, args.start));
    }
    if (!found) {
      found = findNumberAt(editor.document, editor.selection.active);
    }
    if (!found) return;

    let stepDelta = delta;
    if (!Number.isInteger(found.value) && Math.abs(delta) === 1) {
      stepDelta = delta * 0.1;
    }

    const newValue = roundNumber(found.value + stepDelta, 2);
    const newText = `${newValue}${found.unit}`;

    await editor.edit(editBuilder => {
      editBuilder.replace(found.range, newText);
    });
    editor.selection = new vscode.Selection(
      found.range.start,
      new vscode.Position(found.range.start.line, found.range.start.character + newText.length)
    );
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('numberSlider.step', stepHandler),
    vscode.commands.registerCommand('typst-slider.step', stepHandler)
  );

  // 4. Keyboard shortcuts commands with smart fallbacks
  const incHandler = () => stepCurrentNumber(1, 'workbench.action.navigateForward');
  const decHandler = () => stepCurrentNumber(-1, 'workbench.action.navigateBack');
  const incLargeHandler = () => stepCurrentNumber(10);
  const decLargeHandler = () => stepCurrentNumber(-10);

  context.subscriptions.push(
    vscode.commands.registerCommand('numberSlider.increment', incHandler),
    vscode.commands.registerCommand('typst-slider.increment', incHandler),
    vscode.commands.registerCommand('numberSlider.decrement', decHandler),
    vscode.commands.registerCommand('typst-slider.decrement', decHandler),
    vscode.commands.registerCommand('numberSlider.incrementLarge', incLargeHandler),
    vscode.commands.registerCommand('typst-slider.incrementLarge', incLargeHandler),
    vscode.commands.registerCommand('numberSlider.decrementLarge', decLargeHandler),
    vscode.commands.registerCommand('typst-slider.decrementLarge', decLargeHandler)
  );
}

function computeStepSizes(val, unit) {
  if (unit === 'rem' || unit === 'em' || unit === 'ch' || unit === 's' || (Math.abs(val) <= 1 && !Number.isInteger(val))) {
    return { s1: 0.05, s2: 0.1, s3: 0.5, s4: 1 };
  }
  if (!Number.isInteger(val) || Math.abs(val) <= 5) {
    return { s1: 0.1, s2: 1, s3: 5, s4: 10 };
  }
  return { s1: 1, s2: 5, s3: 10, s4: 50 };
}

function generateTrackPresets(val, unit, min, max) {
  let presets;
  if (unit === '%' || unit === 'vh' || unit === 'vw') {
    presets = [0, 25, 50, 75, 100];
  } else if (unit === 'rem' || unit === 'em' || unit === 'ch') {
    presets = [0, 0.5, 1, 1.5, 2, 3, 4];
  } else if (unit === 'px' || unit === 'pt') {
    presets = [0, 10, 25, 50, 100, 200, 400];
  } else if (Math.abs(val) <= 1 && (min === 0 && max === 1)) {
    presets = [0, 0.25, 0.5, 0.75, 1];
  } else {
    const range = max - min;
    const count = 4;
    presets = [];
    for (let i = 0; i <= count; i++) {
      let p = min + (i / count) * range;
      p = roundNumber(p, unit === 'em' || unit === 'rem' ? 1 : 0);
      presets.push(p);
    }
  }

  if (!presets.includes(val)) {
    presets.push(val);
  }
  return Array.from(new Set(presets)).sort((a, b) => a - b);
}

function findNumberAt(document, position) {
  const line = document.lineAt(position.line);
  NUMBER_REGEX.lastIndex = 0;
  let match;
  let closest = null;
  let minDistance = Infinity;

  while ((match = NUMBER_REGEX.exec(line.text)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    const range = new vscode.Range(position.line, start, position.line, end);

    // Direct cursor hit
    if (position.character >= start && position.character <= end) {
      return {
        range,
        fullText: match[0],
        value: parseFloat(match[1]),
        unit: match[2] || '',
        lineText: line.text.trim()
      };
    }

    const dist = Math.min(
      Math.abs(position.character - start),
      Math.abs(position.character - end)
    );
    if (dist < minDistance) {
      minDistance = dist;
      closest = {
        range,
        fullText: match[0],
        value: parseFloat(match[1]),
        unit: match[2] || '',
        lineText: line.text.trim()
      };
    }
  }

  if (minDistance <= 3) {
    return closest;
  }
  return null;
}

async function stepCurrentNumber(delta, fallbackCommand) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const found = findNumberAt(editor.document, editor.selection.active);
  if (!found) {
    if (fallbackCommand) {
      await vscode.commands.executeCommand(fallbackCommand);
    }
    return;
  }

  let stepDelta = delta;
  if (!Number.isInteger(found.value) && Math.abs(delta) === 1) {
    stepDelta = delta * 0.1;
  }

  const newValue = roundNumber(found.value + stepDelta, 2);
  const newText = `${newValue}${found.unit}`;

  await editor.edit(editBuilder => {
    editBuilder.replace(found.range, newText);
  });

  editor.selection = new vscode.Selection(
    found.range.start,
    new vscode.Position(found.range.start.line, found.range.start.character + newText.length)
  );
}

function computeBounds(value, unit) {
  if (unit === '%') {
    return { min: 0, max: Math.max(100, Math.ceil(value * 1.5)), step: 1 };
  }
  if (unit === 'px' || unit === 'pt') {
    if (value < 0) {
      return { min: Math.min(-500, value * 2), max: 100, step: 1 };
    }
    return { min: 0, max: Math.max(500, Math.ceil(value * 2)), step: 1 };
  }
  if (unit === 'rem' || unit === 'em' || unit === 'ch' || unit === 'ex') {
    return { min: 0, max: Math.max(10, Math.ceil(value * 2)), step: 0.1 };
  }
  if (['vh', 'vw', 'vmin', 'vmax', 'dvh', 'dvw', 'svh', 'svw', 'lvh', 'lvw'].includes(unit)) {
    return { min: 0, max: 100, step: 1 };
  }
  if (unit === 'deg') {
    return { min: -360, max: 360, step: 1 };
  }
  if (unit === 'rad') {
    return { min: -6.28, max: 6.28, step: 0.1 };
  }
  if (unit === 'turn') {
    return { min: 0, max: 2, step: 0.1 };
  }
  if (unit === 's') {
    return { min: 0, max: Math.max(10, Math.ceil(value * 2)), step: 0.1 };
  }
  if (unit === 'ms') {
    return { min: 0, max: Math.max(1000, Math.ceil(value * 2)), step: 50 };
  }
  if (unit === 'mm') {
    return { min: 0, max: Math.max(300, Math.ceil(value * 2)), step: 1 };
  }
  if (unit === 'cm') {
    return { min: 0, max: Math.max(30, Math.ceil(value * 2)), step: 0.1 };
  }
  if (unit === 'in') {
    return { min: 0, max: Math.max(20, Math.ceil(value * 2)), step: 0.25 };
  }
  if (unit === 'fr') {
    return { min: 1, max: 12, step: 1 };
  }

  // Raw numbers
  if (Math.abs(value) <= 1 && value !== 0) {
    return { min: 0, max: 1, step: 0.05 };
  }
  return {
    min: Math.floor(value < 0 ? value * 2 : 0),
    max: Math.ceil(value > 0 ? value * 2 : 100),
    step: Number.isInteger(value) ? 1 : 0.1
  };
}

function roundNumber(num, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
