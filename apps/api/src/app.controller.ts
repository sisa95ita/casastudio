import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  getStatus() {
    return {
      name: "CasaStudio API",
      status: "ready"
    };
  }
}
