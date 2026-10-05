CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_projects_owner_updated` ON `projects` (`owner_id`,`updated_at`);--> statement-breakpoint
ALTER TABLE `workflows` ADD `project_id` integer REFERENCES projects(id);--> statement-breakpoint
INSERT INTO `projects` (`owner_id`, `name`, `created_at`, `updated_at`)
SELECT `owner_id`, 'General', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM `workflows` GROUP BY `owner_id`;--> statement-breakpoint
UPDATE `workflows`
SET `project_id` = (SELECT `projects`.`id` FROM `projects` WHERE `projects`.`owner_id` = `workflows`.`owner_id` AND `projects`.`name` = 'General' LIMIT 1)
WHERE `project_id` IS NULL;
