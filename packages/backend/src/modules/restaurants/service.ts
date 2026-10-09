import { db } from "../../db/connection.js";
import { restaurants } from "../../db/schema.js";

export class RestaurantService {
  async listRestaurants() {
    return await db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        address: restaurants.address,
        phone: restaurants.phone,
      })
      .from(restaurants)
      .orderBy(restaurants.name);
  }
}

export const restaurantService = new RestaurantService();
