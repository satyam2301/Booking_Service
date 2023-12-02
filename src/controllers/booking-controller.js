const { StatusCodes } = require('http-status-codes');
const { BookingService } = require('../services');
const { SuccessResponse, ErrorResponse } = require('../utils/common');

const inMemDb = {};

async function createBooking(req, res) {
  try {
    console.log(req.body);
    const response = await BookingService.createBooking({
      flightId: req.body.flightId,
      userId: req.body.userId,
      noOfSeats: req.body.noOfSeats,
    });
    SuccessResponse.data = response;
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.error = error;
    return res.status(error.statusCode).json(ErrorResponse);
  }
}

async function makePayment(req, res) {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'];
    if (!idempotencyKey) {
      ErrorResponse.error = 'Idempotency key is missing.';
      return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }
    if (inMemDb[idempotencyKey]) {
      ErrorResponse.error = `Cannot retry on a successful payment.`;
      return res.status(StatusCodes.BAD_REQUEST).json(ErrorResponse);
    }
    const response = await BookingService.makePayment({
      totalCost: req.body.totalCost,
      userId: req.body.userId,
      bookingId: req.body.bookingId,
    });
    inMemDb[idempotencyKey] = idempotencyKey;
    SuccessResponse.data = response;
    return res.status(StatusCodes.OK).json(SuccessResponse);
  } catch (error) {
    ErrorResponse.error = error;
    return res.status(error.statusCode).json(ErrorResponse);
  }
}

module.exports = {
  createBooking,
  makePayment,
};
