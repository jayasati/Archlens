package com.example.petclinic.pets;

public class Pet {
  private final Long id;
  private final String name;
  private final String species;

  public Pet(Long id, String name, String species) {
    this.id = id;
    this.name = name;
    this.species = species;
  }

  public Long getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public String getSpecies() {
    return species;
  }
}
