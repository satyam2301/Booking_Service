const axios = require('axios');
const { BookingRepository } = require('../repositories');
const { ServerConfig } = require('../config');
const db = require('../models');
const AppError = require('../utils/errors/app-error');
const { StatusCodes } = require('http-status-codes');
const { Enums } = require('../utils/common');
const { BOOKED, CANCELLED, INITIATED, PENDING } = Enums.BOOKING_STATUS;

const bookingRepository = new BookingRepository();

async function createBooking(data) {
  const transaction = await db.sequelize.transaction();
  try {
    const flight = await axios.get(
      `${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${data.flightId}`
    );
    const flightData = flight.data.data;
    if (data.noOfSeats > flightData.totalSeats) {
      throw new AppError('Not enough seats available', StatusCodes.BAD_REQUEST);
    }
    const totalBillingAmount = data.noOfSeats * flightData.price;
    const bookingPayload = { ...data, totalCost: totalBillingAmount };

    const booking = await bookingRepository.createBooking(
      bookingPayload,
      transaction
    );

    await axios.patch(
      `${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${data.flightId}/seats`,
      { seats: data.noOfSeats }
    );

    await transaction.commit();
    return booking;
  } catch (error) {
    await transaction.rollback();
    if (error.code == 'ERR_BAD_REQUEST') {
      throw new AppError(
        'There is no flight available for the request you made!',
        400
      );
    }
    if (error.StatusCode == StatusCodes.BAD_REQUEST) {
      throw new AppError('Sorry! Seats are not available.', error.StatusCode);
    }
    throw new AppError(
      'Sorry! The Booking wad not successful. Booking service is temporarily down.',
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
}

async function makePayment(data) {
  const transaction = await db.sequelize.transaction();
  try {
    const bookingDetails = await bookingRepository.get(
      data.bookingId,
      transaction
    );
    if (bookingDetails.status == BOOKED) {
      throw new AppError(
        'Cannot retry the request on a successful payment.',
        StatusCodes.BAD_REQUEST
      );
    }
    if (bookingDetails.status == CANCELLED) {
      throw new AppError(
        'Booking session has expired.',
        StatusCodes.BAD_REQUEST
      );
    }
    const bookingTime = new Date(bookingDetails.createdAt);
    const currentTime = new Date();
    if (currentTime - bookingTime > 300000) {
      // The transaction will reserve the selected number of seats for 5 minute for user to make payment but if user fails to complete the payment on time then whatever no. of seats was blocked by the current transaction should be released.
      await cancelBooking(data.bookingId);
      throw new AppError(
        'Booking session has expired.',
        StatusCodes.BAD_REQUEST
      );
    }
    if (bookingDetails.userId != data.userId) {
      throw new AppError(
        'The user corresponding to the booking does not match.',
        StatusCodes.NOT_FOUND
      );
    }
    if (bookingDetails.totalCost != data.totalCost) {
      throw new AppError(
        'There is some discrepancy in the amount of the payment.',
        StatusCodes.PAYMENT_REQUIRED
      );
    }
    // we assume that payment is successful now
    const response = await bookingRepository.update(
      data.bookingId,
      { status: BOOKED },
      transaction
    );
    await transaction.commit();
    return response;
  } catch (error) {
    await transaction.rollback();
    if (error.statusCode == StatusCodes.BAD_REQUEST) {
      throw new AppError(
        'Booking session has expired. | The payment has already been made.',
        StatusCodes.BAD_REQUEST
      );
    }
    if (error.statusCode == StatusCodes.PAYMENT_REQUIRED) {
      throw new AppError(
        'Discrepancy in the payment.',
        StatusCodes.PAYMENT_REQUIRED
      );
    }
    if (error.statusCode == StatusCodes.NOT_FOUND) {
      throw new AppError(
        'For the request you made, there is no bookingId / userId available for payment !',
        StatusCodes.NOT_FOUND
      );
    }
    throw new AppError(
      'Sorry! The Booking was not successful. Payment Service is temporarily down.',
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
}

async function cancelBooking(bookingId) {
  const transaction = await db.sequelize.transaction();
  try {
    const bookingDetails = await bookingRepository.get(bookingId, transaction);
    if (bookingDetails.status == CANCELLED) {
      await transaction.commit();
      return true;
    }
    await axios.patch(
      `${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${bookingDetails.flightId}/seats`,
      { seats: bookingDetails.noOfSeats, dec: false }
    );
    await bookingRepository.update(
      bookingId,
      { status: CANCELLED },
      transaction
    );
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    if (error.statusCode == StatusCodes.NOT_FOUND) {
      throw new AppError(
        'For the request you made, there is no bookingId available to cancel !',
        StatusCodes.NOT_FOUND
      );
    }
    throw new AppError(
      'Sorry! The Cancellation was unsuccessful. Cancellation service is temporarily down.',
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
}

async function cancelOldBookings() {
  const transaction = await db.sequelize.transaction();
  try {
    const currentTime = new Date(Date.now() - 1000 * 300);
    const allBookingDetails = await bookingRepository.getAll(currentTime);
    for (const booking of allBookingDetails) {
      const { flightId, noOfSeats } = booking.dataValues;
      await axios.patch(
        `${ServerConfig.FLIGHT_SERVICE}/api/v1/flights/${flightId}/seats`,
        { seats: noOfSeats, dec: false }
      );
    }
    const response = await bookingRepository.cancelOldBookings(currentTime);
    // cancel bookings whose sessions are already expired seats and occupied by those bookings should be set free
    await transaction.commit();
    return response;
  } catch (error) {
    await transaction.rollback();
    throw new AppError(
      'An Error occurred while running the Cron Jon',
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
}

module.exports = {
  createBooking,
  makePayment,
  cancelBooking,
  cancelOldBookings,
};
