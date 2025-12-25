import { ErrorBase } from "@yumi/results";

type Kinds = "IntegrationNotFound" | "InvalidHAToken" | "CallFailed";

export class HAError extends ErrorBase<Kinds> {
	static IntegrationNotFound(integrationId: string) {
		return new HAError(`Integration not found: ${integrationId}`, "IntegrationNotFound");
	}

	static readonly InvalidHAToken = new HAError("Invalid Home Assistant token", "InvalidHAToken");

	static CallFailed(message: string) {
		return new HAError(`Home Assistant call failed: ${message}`, "CallFailed");
	}
}