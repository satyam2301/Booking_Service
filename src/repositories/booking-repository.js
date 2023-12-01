const { StatusCodes } = require('http-status-codes');

const { Booking } = require('../models');
const CrudRepository = require('./crud-repository');
const { Enums } = require('../utils/common');
const { BOOKED, CANCELLED } = Enums.BOOKING_STATUS;

class BookingRepository extends CrudRepository {
  constructor() {
    super(Booking);
  }

  async createBooking(data, transaction) {
    const response = await Booking.create(data, { transaction: transaction });
    return response;
  }

  async get(data, transaction) {
    const response = await this.model.findByPk(data, {
      transaction: transaction,
    });
    if (!response) {
      throw new AppError(
        'Not able to find that resource',
        StatusCodes.NOT_FOUND
      );
    }
    return response;
  }

  // override update function of crud repository
  async update(id, data, transaction) {
    //data->{col:val}
    const response = await Booking.update(
      data,
      {
        where: { id: id },
      },
      {
        transaction: transaction,
      }
    );
    return response;
  }

  async getAll(timestamp) {
    const response = await Booking.findAll({
      where: {
        [Op.and]: [
          {
            createdAt: {
              [Op.lt]: timestamp,
            },
          },
          {
            status: {
              [Op.ne]: BOOKED,
            },
          },
          {
            status: {
              [Op.ne]: CANCELLED,
            },
          },
        ],
      },
    });
    return response;
  }
}

module.exports = BookingRepository;
