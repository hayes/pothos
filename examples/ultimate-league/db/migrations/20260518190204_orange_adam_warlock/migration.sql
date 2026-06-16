CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`home_team_id` integer NOT NULL,
	`away_team_id` integer NOT NULL,
	`complete` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	CONSTRAINT `fk_games_home_team_id_teams_id_fk` FOREIGN KEY (`home_team_id`) REFERENCES `teams`(`id`),
	CONSTRAINT `fk_games_away_team_id_teams_id_fk` FOREIGN KEY (`away_team_id`) REFERENCES `teams`(`id`)
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`team_id` integer NOT NULL,
	`name` text NOT NULL,
	`jersey_number` integer NOT NULL,
	CONSTRAINT `fk_players_team_id_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE,
	CONSTRAINT `players_team_jersey_uniq` UNIQUE(`team_id`,`jersey_number`)
);
--> statement-breakpoint
CREATE TABLE `point_players` (
	`point_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	CONSTRAINT `point_players_pk` PRIMARY KEY(`point_id`, `player_id`),
	CONSTRAINT `fk_point_players_point_id_points_id_fk` FOREIGN KEY (`point_id`) REFERENCES `points`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_point_players_player_id_players_id_fk` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `points` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`game_id` integer NOT NULL,
	`scoring_team_id` integer NOT NULL,
	`started_on_offense` integer NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	CONSTRAINT `fk_points_game_id_games_id_fk` FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_points_scoring_team_id_teams_id_fk` FOREIGN KEY (`scoring_team_id`) REFERENCES `teams`(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`role` text NOT NULL,
	CONSTRAINT `fk_team_roles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_team_roles_team_id_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE,
	CONSTRAINT `team_roles_user_team_uniq` UNIQUE(`user_id`,`team_id`)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL UNIQUE,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` integer NOT NULL,
	`role` text NOT NULL,
	CONSTRAINT `user_roles_pk` PRIMARY KEY(`user_id`, `role`),
	CONSTRAINT `fk_user_roles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`email` text NOT NULL UNIQUE,
	`name` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `games_home_idx` ON `games` (`home_team_id`);--> statement-breakpoint
CREATE INDEX `games_away_idx` ON `games` (`away_team_id`);--> statement-breakpoint
CREATE INDEX `players_team_idx` ON `players` (`team_id`);--> statement-breakpoint
CREATE INDEX `point_players_player_idx` ON `point_players` (`player_id`);--> statement-breakpoint
CREATE INDEX `points_game_idx` ON `points` (`game_id`);--> statement-breakpoint
CREATE INDEX `team_roles_user_idx` ON `team_roles` (`user_id`);--> statement-breakpoint
CREATE INDEX `team_roles_team_idx` ON `team_roles` (`team_id`);