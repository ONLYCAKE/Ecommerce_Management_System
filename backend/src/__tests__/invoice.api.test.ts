/**
 * Backend API Integration Tests for Invoice Endpoints
 * 
 * This file contains Supertest-based integration tests for the invoice API
 * focusing on date/time field handling.
 * 
 * To run these tests:
 * 1. Ensure test database is configured
 * 2. Run: npm test
 * 
 * Prerequisites:
 * - npm install --save-dev supertest @types/supertest jest @types/jest ts-jest
 */

import request from 'supertest'
import app from '../server' // Adjust path to your Express app
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Invoice API - Date/Time Fields', () => {
    let authToken: string
    let testBuyerId: number

    beforeAll(async () => {
        // Setup: Create test user and get auth token
        // This is a skeleton - implement based on your auth system
        const loginResponse = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'testpassword'
            })

        authToken = loginResponse.body.token

        // Create test buyer
        const buyer = await prisma.buyer.create({
            data: {
                name: 'Test Buyer',
                email: 'buyer@test.com',
                phone: '1234567890',
                addressLine1: '123 Test St',
                area: 'Test Area',
                city: 'Test City',
                state: 'Gujarat',
                country: 'India',
                postalCode: '123456'
            }
        })
        testBuyerId = buyer.id
    })

    afterAll(async () => {
        // Cleanup: Delete test data
        await prisma.invoice.deleteMany({ where: { buyerId: testBuyerId } })
        await prisma.buyer.delete({ where: { id: testBuyerId } })
        await prisma.$disconnect()
    })

    it('POST /api/invoices - accepts invoiceDate in YYYY-MM-DD format', async () => {
        const payload = {
            invoiceNo: 'TEST-001',
            buyerId: testBuyerId,
            invoiceDate: '2025-12-10', // YYYY-MM-DD format
            dueDate: '2025-12-20',
            status: 'Processing',
            items: [
                {
                    title: 'Test Product',
                    qty: 1,
                    price: 100,
                    gst: 18,
                    discountPct: 0
                }
            ],
            paymentMethod: 'Cash',
            serviceCharge: 0
        }

        const response = await request(app)
            .post('/api/invoices')
            .set('Authorization', `Bearer ${authToken}`)
            .send(payload)
            .expect(201)

        expect(response.body).toHaveProperty('invoiceNo', 'TEST-001')
        expect(response.body).toHaveProperty('invoiceDate')
        // Verify date is stored correctly
        expect(new Date(response.body.invoiceDate).toISOString().substring(0, 10)).toBe('2025-12-10')
    })

    it('POST /api/invoices - accepts deliveryDateTime in full ISO format', async () => {
        const payload = {
            invoiceNo: 'TEST-002',
            buyerId: testBuyerId,
            invoiceDate: '2025-12-10',
            dueDate: '2025-12-20',
            deliveryDateTime: '2025-12-15T14:30:00.000Z', // Full ISO format
            status: 'Processing',
            items: [
                {
                    title: 'Test Product',
                    qty: 1,
                    price: 100,
                    gst: 18,
                    discountPct: 0
                }
            ],
            paymentMethod: 'Cash',
            serviceCharge: 0
        }

        const response = await request(app)
            .post('/api/invoices')
            .set('Authorization', `Bearer ${authToken}`)
            .send(payload)
            .expect(201)

        expect(response.body).toHaveProperty('deliveryDateTime')
        // Verify datetime is stored correctly
        const deliveryDate = new Date(response.body.deliveryDateTime)
        expect(deliveryDate.getUTCHours()).toBe(14)
        expect(deliveryDate.getUTCMinutes()).toBe(30)
    })

    it('POST /api/invoices - accepts paymentTime in HH:mm format', async () => {
        const payload = {
            invoiceNo: 'TEST-003',
            buyerId: testBuyerId,
            invoiceDate: '2025-12-10',
            dueDate: '2025-12-20',
            paymentTime: '14:30', // HH:mm format
            status: 'Processing',
            items: [
                {
                    title: 'Test Product',
                    qty: 1,
                    price: 100,
                    gst: 18,
                    discountPct: 0
                }
            ],
            paymentMethod: 'Cash',
            serviceCharge: 0
        }

        const response = await request(app)
            .post('/api/invoices')
            .set('Authorization', `Bearer ${authToken}`)
            .send(payload)
            .expect(201)

        expect(response.body).toHaveProperty('paymentTime')
        // Verify time is stored correctly (format may vary based on backend implementation)
        expect(response.body.paymentTime).toMatch(/14:30/)
    })

    it('POST /api/invoices - validates dueDate is not before invoiceDate', async () => {
        const payload = {
            invoiceNo: 'TEST-004',
            buyerId: testBuyerId,
            invoiceDate: '2025-12-20',
            dueDate: '2025-12-10', // Invalid: before invoice date
            status: 'Processing',
            items: [
                {
                    title: 'Test Product',
                    qty: 1,
                    price: 100,
                    gst: 18,
                    discountPct: 0
                }
            ],
            paymentMethod: 'Cash',
            serviceCharge: 0
        }

        const response = await request(app)
            .post('/api/invoices')
            .set('Authorization', `Bearer ${authToken}`)
            .send(payload)
            .expect(400) // Should return bad request

        expect(response.body).toHaveProperty('message')
        expect(response.body.message).toMatch(/due date/i)
    })

    it('POST /api/invoices - handles all date fields together', async () => {
        const payload = {
            invoiceNo: 'TEST-005',
            buyerId: testBuyerId,
            invoiceDate: '2025-12-10',
            dueDate: '2025-12-20',
            deliveryDateTime: '2025-12-15T14:30:00.000Z',
            paymentTime: '14:30',
            status: 'Processing',
            items: [
                {
                    title: 'Test Product',
                    qty: 1,
                    price: 100,
                    gst: 18,
                    discountPct: 0
                }
            ],
            paymentMethod: 'Cash',
            serviceCharge: 0
        }

        const response = await request(app)
            .post('/api/invoices')
            .set('Authorization', `Bearer ${authToken}`)
            .send(payload)
            .expect(201)

        expect(response.body).toHaveProperty('invoiceDate')
        expect(response.body).toHaveProperty('dueDate')
        expect(response.body).toHaveProperty('deliveryDateTime')
        expect(response.body).toHaveProperty('paymentTime')
    })
})

/**
 * Example curl command for manual testing:
 * 
 * curl -X POST http://localhost:5000/api/invoices \
 *   -H "Content-Type: application/json" \
 *   -H "Authorization: Bearer YOUR_TOKEN_HERE" \
 *   -d '{
 *     "invoiceNo": "INV-001",
 *     "buyerId": 1,
 *     "invoiceDate": "2025-12-10",
 *     "dueDate": "2025-12-20",
 *     "deliveryDateTime": "2025-12-15T14:30:00.000Z",
 *     "paymentTime": "14:30",
 *     "status": "Processing",
 *     "items": [{
 *       "title": "Test Product",
 *       "qty": 1,
 *       "price": 100,
 *       "gst": 18,
 *       "discountPct": 0
 *     }],
 *     "paymentMethod": "Cash",
 *     "serviceCharge": 0
 *   }'
 */

export { }
