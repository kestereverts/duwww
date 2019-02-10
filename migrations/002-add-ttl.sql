-- Up
ALTER TABLE `upload` ADD COLUMN `ttl` INTEGER DEFAULT NULL;
-- Down
CREATE TABLE IF NOT EXISTS `upload_new` (
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
INSERT INTO `upload_new` SELECT `id`, 
								`owner`, 
								`originalName`, 
								`processedOriginalName`, 
								`mediaType`, 
								`isBinary`, 
								`size`, 
								`md5hash`, 
								`location`, 
								`timestamp`, 
								`enabled` FROM `upload`;
DROP TABLE `upload`;
ALTER TABLE `upload_new` RENAME TO `upload`;
CREATE INDEX IF NOT EXISTS `enabled_uploadId` ON `upload` (
	`enabled`	DESC,
	`id`
);
