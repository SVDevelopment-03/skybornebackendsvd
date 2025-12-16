import RepositoryAbstract from "../../abstracts/RepositoryAbstract";
import countryModel, { ICountry } from "./country.model";

export default class CountryRepository extends RepositoryAbstract<ICountry> {
  constructor() {
    super(countryModel, "Country");
  }
}
