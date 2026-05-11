package com.example.petclinic.vets;

import java.util.List;
import org.springframework.stereotype.Repository;

@Repository
public class VetRepository {
  public List<Vet> findAll() {
    return List.of(new Vet(1L, "Dr. Doolittle"));
  }
}
