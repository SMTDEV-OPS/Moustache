export interface AppConfig {
  port: number;
  mongoUri: string;
  jwtSecret: string;
  nodeEnv: string;
  aws: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucketName: string;
  };
}

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value === undefined || value === null || value === "") {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config: AppConfig = {
  port: Number(getEnv("PORT", "4000")),
  mongoUri: getEnv("MONGO_URI", "mongodb://localhost:27017/moustachecrm"),
  jwtSecret: getEnv("JWT_SECRET", "change-me-in-production"),
  nodeEnv: getEnv("NODE_ENV", "development"),
  aws: {
    accessKeyId: getEnv("AWS_ACCESS_KEY_ID", ""),
    secretAccessKey: getEnv("AWS_SECRET_ACCESS_KEY", ""),
    region: getEnv("AWS_REGION", ""),
    bucketName: getEnv("AWS_S3_BUCKET_NAME", ""),
  },
};



