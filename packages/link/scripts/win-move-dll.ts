import { existsSync } from "fs";
import { $ } from "bun";

const SRC = process.argv[2] ?? "build/Release";
const DEST = process.argv[3] ?? "release/win";



async function main() {
	if (!existsSync(SRC)) {
		console.error(`Source folder not found: ${SRC}`);
		process.exit(1);
	}

	try {
		console.log(`Copied '${SRC}' → '${DEST}'`);
		$`cp -r ${SRC} ${DEST}`;
	} catch (err) {
		console.error("Failed to copy directory:", err);
		process.exit(2);
	}
}

main();
