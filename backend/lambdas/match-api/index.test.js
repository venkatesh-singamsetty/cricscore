import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from './index.js';
import { Client } from 'pg';

// Mock the AWS SDK Clients
vi.mock('@aws-sdk/client-lambda', () => {
    return {
        LambdaClient: vi.fn().mockImplementation(function() {
            this.send = vi.fn().mockResolvedValue({});
        }),
        InvokeCommand: vi.fn()
    };
});

vi.mock('@aws-sdk/client-ses', () => {
    return {
        SESClient: vi.fn().mockImplementation(function() {
            this.send = vi.fn().mockResolvedValue({});
        }),
        SendEmailCommand: vi.fn()
    };
});

// Mock the PG Client
import pg from 'pg';

export const mockQuery = vi.spyOn(pg.Client.prototype, 'query').mockResolvedValue({rows: []});
export const mockConnect = vi.spyOn(pg.Client.prototype, 'connect').mockResolvedValue();
export const mockEnd = vi.spyOn(pg.Client.prototype, 'end').mockResolvedValue();

describe('match-api Lambda handler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockConnect.mockResolvedValue();
        mockEnd.mockResolvedValue();
    });

    it('should return CORS preflight response for OPTIONS method', async () => {
        const event = { httpMethod: 'OPTIONS' };
        const response = await handler(event);
        
        expect(response.statusCode).toBe(200);
        expect(response.headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
    });

    it('should delete a match and notify broadcaster', async () => {
        mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // Mock delete success
        
        const event = {
            httpMethod: 'DELETE',
            pathParameters: { matchId: '123' }
        };
        
        const response = await handler(event);
        
        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body).message).toBe('Match deleted successfully');
        expect(mockQuery).toHaveBeenCalledWith('DELETE FROM matches WHERE id = $1', ['123']);
        expect(mockEnd).toHaveBeenCalled();
    });

    it('should create a new match successfully', async () => {
        // Mock the insertion of match and innings
        mockQuery
            .mockResolvedValueOnce() // BEGIN
            .mockResolvedValueOnce({ rows: [{ id: 'match_123' }] }) // Insert match
            .mockResolvedValueOnce({ rows: [{ id: 'inning_123' }] }) // Insert inning
            .mockResolvedValueOnce() // COMMIT
        
        const event = {
            httpMethod: 'POST',
            path: '/match',
            body: JSON.stringify({
                teamA: 'India',
                teamB: 'Australia',
                totalOvers: 20,
                batFirstTeam: 'India',
                teamASquad: ['Player1'],
                teamBSquad: []
            })
        };

        const response = await handler(event);
        expect(response.statusCode).toBe(201);
        expect(JSON.parse(response.body).matchId).toBe('match_123');
        expect(mockQuery).toHaveBeenCalledWith('COMMIT');
    });
});
