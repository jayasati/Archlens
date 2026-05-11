package com.example.petclinic.pets;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class PetService {
  private final PetRepository petRepository;

  @Autowired
  public PetService(PetRepository petRepository) {
    this.petRepository = petRepository;
  }

  public Pet findOrThrow(Long id) {
    return petRepository.findById(id)
        .orElseThrow(() -> new IllegalArgumentException("No pet for id " + id));
  }

  public List<Pet> list() {
    return petRepository.findAll();
  }
}
