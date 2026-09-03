CREATE TABLE `room_events` (
	`room_code` text NOT NULL,
	`version` integer NOT NULL,
	`action_id` text NOT NULL,
	`event_json` text NOT NULL,
	`state_json` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`room_code`, `version`),
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_room_events_action` ON `room_events` (`room_code`,`action_id`);--> statement-breakpoint
CREATE INDEX `idx_room_events_room_version` ON `room_events` (`room_code`,`version`);--> statement-breakpoint
CREATE TABLE `room_seats` (
	`room_code` text NOT NULL,
	`role` text NOT NULL,
	`token_hash` text NOT NULL,
	`nickname` text NOT NULL,
	`last_seen_at` integer NOT NULL,
	PRIMARY KEY(`room_code`, `role`, `token_hash`),
	FOREIGN KEY (`room_code`) REFERENCES `rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_room_seats_room_role` ON `room_seats` (`room_code`,`role`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`seed` text NOT NULL,
	`version` integer NOT NULL,
	`state_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_active_at` integer NOT NULL,
	`spectators_open` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rooms_last_active_at` ON `rooms` (`last_active_at`);--> statement-breakpoint
PRAGMA optimize;
