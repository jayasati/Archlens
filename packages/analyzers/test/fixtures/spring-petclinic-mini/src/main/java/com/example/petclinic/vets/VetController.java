package com.example.petclinic.vets;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import com.example.petclinic.pets.PetRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * INTENTIONAL layer-skip: this controller injects PetRepository directly
 * (skipping any service layer). The Spring rules engine should flag this.
 */
@RestController
@RequestMapping("/vets")
public class VetController {
  private final VetRepository vetRepository;

  @Autowired
  private PetRepository petRepository;

  public VetController(VetRepository vetRepository) {
    this.vetRepository = vetRepository;
  }

  @GetMapping
  public List<Vet> list() {
    return vetRepository.findAll();
  }

  @GetMapping("/pets-count")
  public int petsCount() {
    return petRepository.findAll().size();
  }
}
