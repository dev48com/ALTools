import * as vscode from 'vscode';
import * as path from 'path';

const defaultDateFormat = 'YYDDDHHmm';
const dateFormatTokens = /YYYY|DDD|YY|MM|DD|HH|mm|ss/g;

export function formatDate(date: Date, format: string): string {
	const startOfYear = Date.UTC(date.getFullYear(), 0, 1);
	const currentDate = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
	const dayOfYear = Math.floor((currentDate - startOfYear) / 86_400_000) + 1;
	const values: Record<string, string> = {
		YYYY: date.getFullYear().toString().padStart(4, '0'),
		YY: (date.getFullYear() % 100).toString().padStart(2, '0'),
		DDD: dayOfYear.toString().padStart(3, '0'),
		MM: (date.getMonth() + 1).toString().padStart(2, '0'),
		DD: date.getDate().toString().padStart(2, '0'),
		HH: date.getHours().toString().padStart(2, '0'),
		mm: date.getMinutes().toString().padStart(2, '0'),
		ss: date.getSeconds().toString().padStart(2, '0'),
	};

	return format.replace(dateFormatTokens, token => values[token]);
}

export function formatVersionDate(date: Date, format: string): string {
	const versionDate = formatDate(date, format).replace(/[^0-9]/g, '');
	if (!versionDate) {
		throw new Error('The date format must produce at least one digit to update an AL version.');
	}

	return versionDate;
}

export function replaceVersionDate(version: string, date: string): string {
	if (!/^[0-9]+$/.test(date)) {
		throw new Error('The version date must contain digits only.');
	}

	const lastSeparator = version.lastIndexOf('.');
	return `${lastSeparator === -1 ? '' : version.slice(0, lastSeparator + 1)}${date}`;
}

export function replaceAppJsonVersionInContent(content: string, date: string): string {
	let appJson: unknown;
	try {
		appJson = JSON.parse(content);
	} catch (error) {
		const details = error instanceof Error ? error.message : String(error);
		throw new Error(`Could not read app.json: ${details}`);
	}

	if (typeof appJson !== 'object' || appJson === null || !('version' in appJson) || typeof appJson.version !== 'string') {
		throw new Error('A string-valued "version" property was not found in app.json.');
	}

	const range = findVersionValueRange(content);
	if (!range) {
		throw new Error('Could not locate the "version" property in app.json.');
	}

	const updatedVersion = replaceVersionDate(appJson.version, date);
	return content.slice(0, range.start) + JSON.stringify(updatedVersion) + content.slice(range.end);
}

async function updateAppJsonDocument(document: vscode.TextDocument, date: string): Promise<void> {
	const content = document.getText();
	const updatedContent = replaceAppJsonVersionInContent(content, date);
	const edit = new vscode.WorkspaceEdit();
	edit.replace(
		document.uri,
		new vscode.Range(document.positionAt(0), document.positionAt(content.length)),
		updatedContent,
	);

	if (!await vscode.workspace.applyEdit(edit)) {
		throw new Error('Could not update the version in app.json.');
	}
}

export function getAppJsonCandidates(activeFilePath: string, workspaceFolderPath: string): string[] {
	const workspaceRoot = path.resolve(workspaceFolderPath);
	let directory = path.dirname(activeFilePath);
	const candidates: string[] = [];

	while (true) {
		const relativePath = path.relative(workspaceRoot, directory);
		if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
			break;
		}

		candidates.push(path.join(directory, 'app.json'));
		if (relativePath === '') {
			break;
		}

		const parentDirectory = path.dirname(directory);
		if (parentDirectory === directory) {
			break;
		}
		directory = parentDirectory;
	}

	return candidates;
}

async function findProjectAppJson(activeFile: vscode.Uri): Promise<vscode.Uri> {
	if (activeFile.scheme !== 'file') {
		throw new Error('The active file must be a local file in a workspace.');
	}

	const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeFile);
	if (!workspaceFolder || workspaceFolder.uri.scheme !== 'file') {
		throw new Error('The active file is not in a local workspace folder.');
	}

	const candidates = getAppJsonCandidates(activeFile.fsPath, workspaceFolder.uri.fsPath);
	for (const candidate of candidates) {
		const files = await vscode.workspace.findFiles(
			new vscode.RelativePattern(vscode.Uri.file(path.dirname(candidate)), 'app.json'),
			'**/{.git,node_modules,.alpackages}/**',
			1,
		);
		if (files.length > 0) {
			return files[0];
		}
	}

	throw new Error('No app.json file was found in the active file\'s project.');
}

function findVersionValueRange(content: string): { start: number; end: number } | undefined {
	const tokens = [...content.matchAll(/"(?:\\.|[^"\\])*"|[{}[\]]|:/g)];
	let depth = 0;

	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index][0];
		if (token.startsWith('"') && depth === 1 && JSON.parse(token) === 'version'
			&& tokens[index + 1]?.[0] === ':' && tokens[index + 2]?.[0].startsWith('"')) {
			const valueToken = tokens[index + 2];
			return { start: valueToken.index!, end: valueToken.index! + valueToken[0].length };
		}

		if (token === '{' || token === '[') {
			depth++;
		} else if (token === '}' || token === ']') {
			depth--;
		}
	}

	return undefined;
}

export function activate(context: vscode.ExtensionContext) {
	const insertDisposable = vscode.commands.registerCommand('dev48.insertDate', () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const format = vscode.workspace.getConfiguration('dev48-altools').get('dateFormat', defaultDateFormat);
			const formattedDate = formatDate(new Date(), format);
			editor.edit(editBuilder => {
				editBuilder.insert(editor.selection.active, formattedDate);
			});
		}
	});
	context.subscriptions.push(insertDisposable);

	const updateVersionDisposable = vscode.commands.registerCommand('dev48.updateAppJsonVersion', async () => {
		try {
			const activeEditor = vscode.window.activeTextEditor;
			if (!activeEditor) {
				throw new Error('Open a file in the project whose version you want to update.');
			}

			const appJsonUri = await findProjectAppJson(activeEditor.document.uri);
			const document = await vscode.workspace.openTextDocument(appJsonUri);
			const format = vscode.workspace.getConfiguration('dev48-altools').get('dateFormat', defaultDateFormat);
			await updateAppJsonDocument(document, formatVersionDate(new Date(), format));
			if (!await document.save()) {
				throw new Error('Could not save the updated app.json.');
			}
			void vscode.window.showInformationMessage(`Updated version in ${vscode.workspace.asRelativePath(appJsonUri, true)}`);
		} catch (error) {
			const details = error instanceof Error ? error.message : String(error);
			void vscode.window.showErrorMessage(details);
		}
	});
	context.subscriptions.push(updateVersionDisposable);
}
