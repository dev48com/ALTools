import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { formatDate, formatVersionDate, getAppJsonCandidates, replaceAppJsonVersionInContent, replaceVersionDate } from '../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('preserves the default Julian date format', () => {
		assert.strictEqual(formatDate(new Date(2024, 0, 2, 3, 4), 'YYDDDHHmm'), '240020304');
	});

	test('formats calendar dates and day of year', () => {
		assert.strictEqual(formatDate(new Date(2024, 11, 31, 9, 5, 7), 'YYYY-MM-DD DDD HH:mm:ss'), '2024-12-31 366 09:05:07');
	});

	test('removes non-digits from the configured version date format', () => {
		assert.strictEqual(formatVersionDate(new Date(2024, 9, 5), 'YYYY-MM-DD'), '20241005');
	});

	test('rejects a version date format without digits', () => {
		assert.throws(
			() => formatVersionDate(new Date(2024, 9, 5), 'release'),
			/The date format must produce at least one digit/,
		);
	});

	test('supports day 365 in a non-leap year', () => {
		assert.strictEqual(formatDate(new Date(2023, 11, 31), 'DDD'), '365');
	});

	test('replaces only the final version component', () => {
		assert.strictEqual(replaceVersionDate('1.2.3.123', '262741146'), '1.2.3.262741146');
	});

	test('sets the date when version has no components', () => {
		assert.strictEqual(replaceVersionDate('1', '262741146'), '262741146');
	});

	test('rejects non-numeric version components', () => {
		assert.throws(
			() => replaceVersionDate('1.2.3.4', '2024-10-05'),
			/The version date must contain digits only/,
		);
	});

	test('updates only the top-level app.json version while preserving formatting', () => {
		const content = '{\n  "version": "1.2.3.123",\n  "metadata": { "version": "unchanged" }\n}\n';
		assert.strictEqual(
			replaceAppJsonVersionInContent(content, '262741146'),
			'{\n  "version": "1.2.3.262741146",\n  "metadata": { "version": "unchanged" }\n}\n',
		);
	});

	test('reports invalid app.json content', () => {
		assert.throws(
			() => replaceAppJsonVersionInContent('{"version": 1}', '262741146'),
			/A string-valued "version" property was not found/,
		);
	});
});
