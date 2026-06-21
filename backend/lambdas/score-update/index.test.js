import { describe, it, expect, vi, beforeEach } from 'vitest';
process.env.MATCH_EVENTS_TOPIC = 'arn:aws:sns:us-east-1:123456789012:test-topic';
import { handler } from './index.js';
import { SNSClient } from '@aws-sdk/client-sns';

// Mock SNS Client using prototype
export const mockSend = vi.spyOn(SNSClient.prototype, 'send').mockResolvedValue({ MessageId: 'mock-sns-id-123' });

describe('score-update Lambda handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.MATCH_EVENTS_TOPIC = 'arn:aws:sns:us-east-1:123456789012:test-topic';
    });

    it('should return CORS preflight response for OPTIONS method', async () => {
        const event = { httpMethod: 'OPTIONS' };
        const response = await handler(event);
        
        expect(response.statusCode).toBe(200);
        expect(response.headers['Access-Control-Allow-Methods']).toContain('POST,OPTIONS');
    });

    it('should publish STATE_SYNC event to SNS and return success', async () => {
        const event = {
            body: JSON.stringify({
                matchId: 'match_123',
                inningId: 'inning_123',
                syncOnly: true
            })
        };

        const response = await handler(event);
        
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.messageId).toBe('mock-sns-id-123');
    });

    it('should publish LIVE_SCORE_UPDATE event to SNS and return success', async () => {
        const event = {
            body: JSON.stringify({
                matchId: 'match_123',
                inningId: 'inning_123',
                runs: 4,
                ball: 1
            })
        };

        const response = await handler(event);
        
        expect(response.statusCode).toBe(200);
        const responseBody = JSON.parse(response.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.messageId).toBe('mock-sns-id-123');
    });
});
