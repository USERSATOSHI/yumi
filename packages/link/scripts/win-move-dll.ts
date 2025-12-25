import { join } from "path";
import { mkdir, readdir, copyFile, stat } from "fs/promises";
import { existsSync } from "fs";

const SRC = process.argv[2] ?? "build/Release";
const DEST = process.argv[3] ?? "releases/win";

async function copyDir(src: string, dest: string) {
	await mkdir(dest, { recursive: true });
	const entries = await readdir(src, { withFileTypes: true });
	for (const entry of entries) {
		const srcPath = join(src, entry.name);
		const destPath = join(dest, entry.name);
		if (entry.isDirectory()) {
			await copyDir(srcPath, destPath);
		} else if (entry.isFile()) {
			await copyFile(srcPath, destPath);
		} else {
			// ignore symlinks and others for simplicity
			const s = await stat(srcPath).catch(() => null);
			if (s && s.isFile()) await copyFile(srcPath, destPath);
		}
	}
}

async function main() {
	if (!existsSync(SRC)) {
		console.error(`Source folder not found: ${SRC}`);
		process.exit(1);
	}

	try {
		await copyDir(SRC, DEST);
		console.log(`Copied '${SRC}' → '${DEST}'`);
	} catch (err) {
		console.error("Failed to copy directory:", err);
		process.exit(2);
	}
}

main();
