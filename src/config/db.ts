import dns from 'dns';
import mongoose from 'mongoose';

const PUBLIC_DNS_SERVERS = ['8.8.8.8', '1.1.1.1'];

const connectOptions = {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
};

// On some Windows setups the DNS server Node picks up (often 127.0.0.1) refuses the
// SRV lookup that mongodb+srv:// URIs need. Retry once through public resolvers.
const connectWithDnsRetry = async (mongoURI: string): Promise<void> => {
  try {
    await mongoose.connect(mongoURI, connectOptions);
  } catch (error: any) {
    const srvLookupRefused = error?.syscall === 'querySrv' && error?.code === 'ECONNREFUSED';

    if (!srvLookupRefused) {
      throw error;
    }

    console.warn(
      `⚠️ DNS servers [${dns.getServers().join(', ')}] refused the MongoDB SRV lookup, retrying with [${PUBLIC_DNS_SERVERS.join(', ')}]`
    );
    dns.setServers(PUBLIC_DNS_SERVERS);
    await mongoose.connect(mongoURI, connectOptions);
  }
};

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/skyborne';

    try {
      await connectWithDnsRetry(mongoURI);
    } catch (primaryError: any) {
      const shouldTryLocalFallback =
        mongoURI.includes('mongodb+srv://') &&
        primaryError?.code === 'ETIMEOUT' &&
        process.env.MONGO_ALLOW_LOCAL_FALLBACK !== 'false';

      if (!shouldTryLocalFallback) {
        throw primaryError;
      }

      const localMongoURI = process.env.MONGO_LOCAL_URI || 'mongodb://localhost:27017/skyborne';
      console.warn('⚠️ Atlas MongoDB timed out, falling back to local MongoDB:', localMongoURI);
      await mongoose.connect(localMongoURI, connectOptions);
    }
    
    console.log('✅ MongoDB Connected');
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

export default connectDB;
