import { validateOperation } from "../../utils/transactionValidation";
import { simulateTransaction, createOperation } from "../transactionBuilder";
import * as StellarSdk from "@stellar/stellar-sdk";

describe("TTL and State Archival Operations", () => {
  describe("Validation", () => {
    it("should validate extendFootprintTtl successfully", () => {
      const errors = validateOperation("extendFootprintTtl", { extendTo: "100" });
      expect(errors).toHaveLength(0);
    });

    it("should fail validation for extendFootprintTtl with invalid target", () => {
      const errors = validateOperation("extendFootprintTtl", { extendTo: "-100" });
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe("extendTo");
      
      const errors2 = validateOperation("extendFootprintTtl", { extendTo: "abc" });
      expect(errors2).toHaveLength(1);
    });

    it("should validate restoreFootprint successfully", () => {
      const errors = validateOperation("restoreFootprint", {});
      expect(errors).toHaveLength(0);
    });
  });

  describe("createOperation", () => {
    it("should create extendFootprintTtl operation", () => {
      const op = createOperation("extendFootprintTtl", { extendTo: "12345" });
      expect(op.type).toBe("extendFootprintTtl");
    });

    it("should create restoreFootprint operation", () => {
      const op = createOperation("restoreFootprint", {});
      expect(op.type).toBe("restoreFootprint");
    });
  });
});
