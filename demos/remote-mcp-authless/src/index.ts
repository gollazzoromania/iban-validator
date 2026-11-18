import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { z } from "zod";

function createServer() {
	const server = new McpServer({
		name: "Global IBAN Validator",
		version: "1.0.0",
	});

	server.registerTool(
		"validate_iban",
		{
			description: "Validates any international IBAN bank account number mathematically using ISO 7064 MOD 97-10.",
			inputSchema: z.object({
				iban: z.string().describe("The IBAN string to validate, with or without spaces"),
			}),
		},
		async ({ iban }) => {
			const cleanIban = iban.replace(/\s+/g, "").toUpperCase();

			if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(cleanIban)) {
				return {
					content: [{
						type: "text",
						text: JSON.stringify({ valid: false, iban: cleanIban, reason: "Invalid IBAN format or length" }),
					}],
				};
			}

			const rearranged = cleanIban.slice(4) + cleanIban.slice(0, 4);
			const numericString = rearranged.replace(/[A-Z]/g, (char) => (char.charCodeAt(0) - 55).toString());

			let remainder = 0;
			for (let i = 0; i < numericString.length; i++) {
				remainder = (remainder * 10 + parseInt(numericString[i], 10)) % 97;
			}

			const isValid = remainder === 1;
			const countryCode = cleanIban.slice(0, 2);

			return {
				content: [{
					type: "text",
					text: JSON.stringify({
						valid: isValid,
						iban: cleanIban,
						country: countryCode,
						reason: isValid ? "Valid IBAN checksum" : "Invalid mathematical checksum",
					}),
				}],
			};
		}
	);

	return server;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);
		if (url.pathname === "/mcp") {
			const server = createServer();
			return createMcpHandler(server)(request, env, ctx);
		}
		return new Response("Global IBAN Validator MCP Server is running!", { status: 200 });
	},
};
