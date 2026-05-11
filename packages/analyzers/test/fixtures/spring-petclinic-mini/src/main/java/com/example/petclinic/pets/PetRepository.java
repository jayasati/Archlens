package com.example.petclinic.pets;

import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public class PetRepository {
  public Optional<Pet> findById(Long id) {
    if (id == null || id < 1) {
      return Optional.empty();
    }
    return Optional.of(new Pet(id, "Rex", "dog"));
  }

  public List<Pet> findAll() {
    return List.of(new Pet(1L, "Rex", "dog"), new Pet(2L, "Whiskers", "cat"));
  }
}
