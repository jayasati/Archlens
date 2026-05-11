package com.example.petclinic.pets;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/pets")
public class PetController {
  private final PetService petService;

  @Autowired
  public PetController(PetService petService) {
    this.petService = petService;
  }

  @GetMapping
  public List<Pet> list() {
    return petService.list();
  }

  @GetMapping("/{id}")
  public Pet get(@PathVariable Long id) {
    return petService.findOrThrow(id);
  }
}
