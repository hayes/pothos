CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text,
	`author_id` integer,
	`post_id` integer
);

CREATE TABLE `groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text
);

CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content` text,
	`author_id` integer
);

CREATE TABLE `profile_info` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`metadata` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);

CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text,
	`invited_by` integer
);

CREATE TABLE `users_to_groups` (
	`user_id` integer NOT NULL,
	`group_id` integer NOT NULL,
	PRIMARY KEY(`user_id`, `group_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`)
);
