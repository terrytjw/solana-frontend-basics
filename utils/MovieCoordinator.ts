import * as web3 from "@solana/web3.js";
import { Movie } from "@/utils/models";
import { PublicKey } from "@solana/web3.js";
import { MOVIE_REVIEW_PROGRAM_ID } from "./config";
import bs58 from "bs58";

export class MovieCoordinator {
  static accounts: web3.PublicKey[] = [];

  static async prefetchAccounts(connection: web3.Connection, search: string) {
    const accounts = await connection.getProgramAccounts(
      new web3.PublicKey(MOVIE_REVIEW_PROGRAM_ID),
      {
        dataSlice: { offset: 2, length: 18 },
        filters:
          search === ""
            ? []
            : [
                {
                  memcmp: {
                    offset: 6,
                    bytes: bs58.encode(Buffer.from(search)),
                  },
                },
              ],
      }
    );

    // @ts-ignore
    accounts.sort((a, b) => {
      const lengthA = a.account.data.readUInt32LE(0);
      const lengthB = b.account.data.readUInt32LE(0);
      const dataA = a.account.data.slice(4, 4 + lengthA);
      const dataB = b.account.data.slice(4, 4 + lengthB);
      return dataA.compare(dataB);
    });

    this.accounts = accounts.map((account) => account.pubkey);
  }

  static async fetchPage(
    connection: web3.Connection,
    page: number,
    perPage: number,
    search: string,
    reload: boolean = false
  ): Promise<Movie[]> {
    if (this.accounts.length === 0 || reload) {
      await this.prefetchAccounts(connection, search);
    }

    const paginatedPublicKeys = this.accounts.slice(
      (page - 1) * perPage,
      page * perPage
    );

    if (paginatedPublicKeys.length === 0) {
      return [];
    }

    const accounts = await connection.getMultipleAccountsInfo(
      paginatedPublicKeys
    );

    const movies = accounts.reduce((accum: Movie[], account) => {
      const movie = Movie.deserialize(account?.data);
      if (!movie) {
        return accum;
      }

      return [...accum, movie];
    }, []);

    return movies;
  }
}