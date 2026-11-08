const vscode = require("vscode");

const UNIT_REGEX_PART =
	"%|px|rem|em|vh|vw|vmin|vmax|dvh|dvw|svh|svw|lvh|lvw|ch|ex|pt|mm|cm|in|pc|deg|rad|grad|turn|s|ms|fr";
const NUMBER_REGEX = new RegExp(
	`(?<![\\w#])(-?\\d+(?:\\.\\d+)?)(?:(${UNIT_REGEX_PART})\\b|(?![a-zA-Z_]))`,
	"g",
);

function activate(context) {
	const hoverProvider = vscode.languages.registerHoverProvider(
		{ scheme: "file" },
		{
			provideHover(document, position) {
				const found = findNumberAt(document, position);
				if (!found) return null;

				const contents = new vscode.MarkdownString();
				contents.isTrusted = true;
				contents.supportHtml = true;

				const val = found.value;
				const unit = found.unit;

				const makeStepLink = (lbl, delta) => {
					const cmdArgs = encodeURIComponent(
						JSON.stringify({
							line: found.range.start.line,
							start: found.range.start.character,
							delta,
						}),
					);
					return `[ ${lbl} ](command:numberSlider.step?${cmdArgs})`;
				};

				const steps = computeStepSizes(val, unit);
				contents.appendMarkdown(
					`${makeStepLink(`◀◀ -${steps.s4}`, -steps.s4)} `,
				);
				contents.appendMarkdown(
					`${makeStepLink(`◀ -${steps.s3}`, -steps.s3)} `,
				);
				contents.appendMarkdown(
					`${makeStepLink(`‹ -${steps.s1}`, -steps.s1)} `,
				);
				contents.appendMarkdown(`&nbsp;**\`${val}${unit}\`**&nbsp; `);
				contents.appendMarkdown(
					`${makeStepLink(`+${steps.s1} ›`, steps.s1)} `,
				);
				contents.appendMarkdown(
					`${makeStepLink(`+${steps.s3} ▶`, steps.s3)} `,
				);
				contents.appendMarkdown(
					`${makeStepLink(`+${steps.s4} ▶▶`, steps.s4)}\n\n`,
				);

				contents.appendMarkdown(`---\n`);

				return new vscode.Hover(contents, found.range);
			},
		},
	);
	context.subscriptions.push(hoverProvider);

	// 2. Command: Set exact value
	const setHandler = async (args) => {
		const editor = vscode.window.activeTextEditor;
		if (!editor || !args || typeof args.value !== "number") return;

		let found = null;
		if (args.line !== undefined && args.start !== undefined) {
			found = findNumberAt(
				editor.document,
				new vscode.Position(args.line, args.start),
			);
		}
		if (!found) {
			found = findNumberAt(editor.document, editor.selection.active);
		}
		if (!found) return;

		const newText = `${args.value}${found.unit}`;
		await editor.edit((editBuilder) => {
			editBuilder.replace(found.range, newText);
		});
		editor.selection = new vscode.Selection(
			found.range.start,
			new vscode.Position(
				found.range.start.line,
				found.range.start.character + newText.length,
			),
		);
	};
	context.subscriptions.push(
		vscode.commands.registerCommand("numberSlider.set", setHandler),
	);

	const stepHandler = async (args) => {
		const delta = args && typeof args.delta === "number" ? args.delta : 1;
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		let found = null;
		if (args && args.line !== undefined && args.start !== undefined) {
			found = findNumberAt(
				editor.document,
				new vscode.Position(args.line, args.start),
			);
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

		await editor.edit((editBuilder) => {
			editBuilder.replace(found.range, newText);
		});
		editor.selection = new vscode.Selection(
			found.range.start,
			new vscode.Position(
				found.range.start.line,
				found.range.start.character + newText.length,
			),
		);
	};
	context.subscriptions.push(
		vscode.commands.registerCommand("numberSlider.step", stepHandler),
	);

	const incHandler = () =>
		stepCurrentNumber(1, "workbench.action.navigateForward");
	const decHandler = () =>
		stepCurrentNumber(-1, "workbench.action.navigateBack");
	const incLargeHandler = () => stepCurrentNumber(10);
	const decLargeHandler = () => stepCurrentNumber(-10);

	context.subscriptions.push(
		vscode.commands.registerCommand("numberSlider.increment", incHandler),
		vscode.commands.registerCommand("numberSlider.decrement", decHandler),
		vscode.commands.registerCommand(
			"numberSlider.incrementLarge",
			incLargeHandler,
		),
		vscode.commands.registerCommand(
			"numberSlider.decrementLarge",
			decLargeHandler,
		),
	);
}

function computeStepSizes(val, unit) {
	if (
		unit === "rem" ||
		unit === "em" ||
		unit === "ch" ||
		unit === "s" ||
		(Math.abs(val) <= 1 && !Number.isInteger(val))
	) {
		return { s1: 0.05, s2: 0.1, s3: 0.5, s4: 1 };
	}
	if (!Number.isInteger(val) || Math.abs(val) <= 5) {
		return { s1: 0.1, s2: 1, s3: 5, s4: 10 };
	}
	return { s1: 1, s2: 5, s3: 10, s4: 50 };
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
		const range = new vscode.Range(
			position.line,
			start,
			position.line,
			end,
		);

		if (position.character >= start && position.character <= end) {
			return {
				range,
				fullText: match[0],
				value: parseFloat(match[1]),
				unit: match[2] || "",
				lineText: line.text.trim(),
			};
		}

		const dist = Math.min(
			Math.abs(position.character - start),
			Math.abs(position.character - end),
		);
		if (dist < minDistance) {
			minDistance = dist;
			closest = {
				range,
				fullText: match[0],
				value: parseFloat(match[1]),
				unit: match[2] || "",
				lineText: line.text.trim(),
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

	await editor.edit((editBuilder) => {
		editBuilder.replace(found.range, newText);
	});

	editor.selection = new vscode.Selection(
		found.range.start,
		new vscode.Position(
			found.range.start.line,
			found.range.start.character + newText.length,
		),
	);
}

function roundNumber(num, decimals = 2) {
	const factor = Math.pow(10, decimals);
	return Math.round(num * factor) / factor;
}

function deactivate() {}

module.exports = {
	activate,
	deactivate,
};
