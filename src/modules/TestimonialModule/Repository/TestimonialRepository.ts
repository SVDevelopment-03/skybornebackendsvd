import RepositoryAbstract from "../../../abstracts/RepositoryAbstract";

import Testimonials, { ITestimonial } from "../models/Testimonials";

export default class TestimonialRepository extends RepositoryAbstract<ITestimonial> {
  constructor() {
    super(Testimonials, "Testimonials");
  }
}
