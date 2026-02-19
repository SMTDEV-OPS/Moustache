import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config/env";
import { logger } from "../config/logger";

export class StorageService {
    private static s3Client: S3Client;
    private static bucketName = config.aws.bucketName;

    private static getClient() {
        if (!this.s3Client) {
            if (!config.aws.accessKeyId || !config.aws.secretAccessKey || !config.aws.region) {
                logger.warn("AWS credentials not fully configured. Storage operations may fail.");
            }
            this.s3Client = new S3Client({
                region: config.aws.region,
                credentials: {
                    accessKeyId: config.aws.accessKeyId,
                    secretAccessKey: config.aws.secretAccessKey,
                },
            });
        }
        return this.s3Client;
    }

    /**
     * Upload a file to S3
     * @returns The S3 key (path)
     */
    static async uploadFile(
        fileBuffer: Buffer,
        originalName: string,
        mimeType: string,
        folder: string = "knowledge-base"
    ): Promise<string> {
        const key = `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}-${originalName}`;

        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: fileBuffer,
            ContentType: mimeType,
        });

        try {
            await this.getClient().send(command);
            logger.info(`File uploaded to S3: ${key}`);
            return key;
        } catch (error) {
            logger.error(`S3 upload failed for ${key}`, { error: error });
            throw error;
        }
    }

    /**
     * Generate a presigned URL for temporary access to a file
     */
    static async getSignedUrl(key: string, expiresMinutes: number = 15): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        try {
            const url = await getSignedUrl(this.getClient(), command, { expiresIn: expiresMinutes * 60 });
            return url;
        } catch (error) {
            logger.error(`S3 signed URL generation failed for ${key}`, { error: error });
            throw error;
        }
    }

    /**
     * Delete a file from S3
     */
    static async deleteFile(key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        try {
            await this.getClient().send(command);
            logger.info(`File deleted from S3: ${key}`);
        } catch (error: any) {
            // S3 doesn't throw 404 for delete if file doesn't exist, but if it does error we log it
            logger.error(`S3 delete failed for ${key}`, { error: error });
            throw error;
        }
    }
}
