
-- Up
CREATE TABLE  IF NOT EXISTS `user` (
	`id`	INTEGER NOT NULL,
	`email`	TEXT NOT NULL UNIQUE,
	`password`	TEXT NOT NULL,
	`apiKey`	TEXT NOT NULL,
	`enabled`	INTEGER NOT NULL DEFAULT 1,
	PRIMARY KEY(`id`)
);
CREATE TABLE IF NOT EXISTS `upload` (
	`id`	INTEGER NOT NULL,
	`owner`	INTEGER NOT NULL,
	`originalName`	TEXT,
	`processedOriginalName` TEXT,
	`mediaType`	TEXT,
	`isBinary` INTEGER,
	`size`	INTEGER NOT NULL,
	`md5hash`	TEXT NOT NULL,
	`location`	TEXT NOT NULL,
	`timestamp`	INTEGER,
	`enabled`	INTEGER NOT NULL DEFAULT 1,
	PRIMARY KEY(`id`),
	FOREIGN KEY(`owner`) REFERENCES `user`(`id`)
);
CREATE INDEX IF NOT EXISTS `enabled_uploadId` ON `upload` (
	`enabled`	DESC,
	`id`
);
CREATE INDEX IF NOT EXISTS `enabled_apiKey` ON `user` (
	`enabled`	DESC,
	`apiKey`
);

-- Down
DROP INDEX enabled_alias;
DROP INDEX enabled_apiKey;
DROP INDEX enabled_uploadId;
DROP TABLE upload;
DROP TABLE user;