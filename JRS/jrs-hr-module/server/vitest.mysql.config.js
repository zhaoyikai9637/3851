import { defineConfig } from 'vitest/config';
export default defineConfig({ test:{environment:'node',include:['tests/mysql.test.js'],fileParallelism:false,testTimeout:30000,hookTimeout:30000} });
